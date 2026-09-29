import { readFile } from 'node:fs/promises';
import { CliError } from '../errors.js';
import { appendEvent, readSpecFacts, readStatus, writeStatus } from './context.js';
import { lockTests, relockTests, runGate } from './gate.js';
import {
  applyResult,
  createStatus,
  loadTasks,
  nextAction,
  recordPmFailure,
  resetFailedTasks,
  Result,
  resumeRun,
  SpecState,
  Step,
  TransitionError,
  validatePmTasks,
} from './state-machine.js';
import { ensureWorktree, headCommit, switchToTaskBranch } from './worktree.js';

const COMMIT_STEPS = [Step.Stub, Step.Tests];
const AGENT_STEPS = [Step.Stub, Step.Tests, Step.Implement, Step.Review, Step.Qc];
const VALID_RESULTS = Object.values(Result);

export async function startRun(context, now) {
  const facts = await readSpecFacts(context.specPath);
  if (facts.specStatus !== 'approved') throw new CliError(`Spec chưa approved (đang '${facts.specStatus}')`);
  const existing = await readStatus(context);
  assertStartable(existing, facts);
  await ensureWorktree(context);
  const status = await startingStatus(context, existing, facts, now);
  await writeStatus(context, status);
  await appendEvent(context, { type: 'run-start', detail: existing ? `làm tiếp từ ${existing.state}` : 'bắt đầu mới' });
  return status;
}

function assertStartable(existing, facts) {
  if (existing?.state === SpecState.Done) throw new CliError('Spec đã done, không có gì để chạy');
  if (existing?.state === SpecState.Failed && existing.specHash === facts.specHash) {
    throw new CliError('Spec đã failed và chưa được sửa; sửa spec.md để chạy lại');
  }
}

async function startingStatus(context, existing, facts, now) {
  if (!existing) {
    return createStatus({
      project: context.projectName,
      spec: context.specName,
      specHash: facts.specHash,
      branch: context.branch,
      worktree: context.worktreePath,
      now,
    });
  }
  if (existing.state === SpecState.Failed) {
    const { status, activated } = resetFailedTasks(existing, facts.specHash);
    if (activated) await switchAndRecord(context, status, activated);
    return resumeRun(status, now);
  }
  return resumeRun(existing, now);
}

export async function planNext(context, now) {
  const status = await requireStatus(context);
  const beating = { ...status, heartbeat: now };
  await writeStatus(context, beating);
  const action = nextAction(beating, { maxAgentCallsPerRun: context.config.MAX_AGENT_CALLS_PER_RUN });
  if (action.kind === 'pause') await appendEvent(context, { type: 'pause', detail: action.reason });
  return { ...action, ...describeTask(context, beating, action.task) };
}

export async function recordStep(context, input, now) {
  if (!VALID_RESULTS.includes(input.result)) throw new CliError(`--result phải là một trong: ${VALID_RESULTS.join(', ')}`);
  if (!AGENT_STEPS.includes(input.step)) {
    throw new CliError(`Bước '${input.step}' không ghi tay được. Bước máy (lock, gate) chạy bằng: run ${input.step}`);
  }
  const status = await requireStatus(context);
  const commit = COMMIT_STEPS.includes(input.step) ? headCommit(context.worktreePath) : undefined;
  const outcome = transition(status, { ...input, commit });
  const next = await afterTransition(context, outcome, now);
  await appendEvent(context, { type: 'step', task: input.task, step: input.step, result: input.result, detail: input.note ?? '' });
  return next;
}

export async function importPmTasks(context, now) {
  const status = await requireStatus(context);
  if (status.tasks) throw new CliError('PM task đã được nạp cho spec này');
  const facts = await readSpecFacts(context.specPath);
  const pmTasks = await readPmTasks(context);
  const errors = pmTasks.parseError ? [pmTasks.parseError] : validatePmTasks(pmTasks.value, facts.acs);
  if (errors.length) {
    const outcome = recordPmFailure(status, errors.join('; '));
    await writeStatus(context, { ...outcome.status, heartbeat: now });
    await appendEvent(context, { type: 'pm-tasks-rejected', detail: errors.join('\n') });
    return { ok: false, errors, state: outcome.status.state };
  }
  const outcome = loadTasks({ ...status, agentCalls: status.agentCalls + 1, runAgentCalls: status.runAgentCalls + 1 }, pmTasks.value);
  const next = await afterTransition(context, outcome, now);
  await appendEvent(context, { type: 'pm-tasks-loaded', detail: next.tasks.map((task) => task.id).join(', ') });
  return { ok: true, tasks: next.tasks.map(({ id, title, acs, state }) => ({ id, title, acs, state })) };
}

export async function runMachineStep(context, command, taskId, now) {
  const status = await requireStatus(context);
  const task = status.tasks?.find((candidate) => candidate.id === taskId);
  if (!task || task.step !== command) throw new CliError(`${taskId} không ở bước ${command}`);
  const check = command === Step.Lock ? lockTests(context, task) : runGate(context, task);
  const outcome = transition(status, { task: taskId, step: command, result: check.result, note: check.note, lock: check.lock });
  await afterTransition(context, outcome, now);
  await appendEvent(context, { type: command, task: taskId, round: task.round, result: check.result, detail: check.note });
  return check;
}

export async function relock(context, taskId, reason, now) {
  const status = await requireStatus(context);
  const task = status.tasks?.find((candidate) => candidate.id === taskId);
  if (!task || task.step !== Step.Qc) throw new CliError(`Chỉ QC ở bước qc mới được sửa test đã khóa (${taskId} đang ở ${task?.step})`);
  const check = relockTests(context, task, reason);
  if (check.result === Result.Pass) {
    const tasks = status.tasks.map((candidate) => (candidate.id === taskId ? { ...candidate, lock: check.lock } : candidate));
    await writeStatus(context, { ...status, tasks, heartbeat: now });
  }
  await appendEvent(context, { type: 'relock', task: taskId, result: check.result, detail: check.note });
  return check;
}

export async function recordAssumption(context, taskId, note) {
  await requireStatus(context);
  await appendEvent(context, { type: 'assumption', task: taskId ?? null, detail: note });
  return { recorded: 'assumption' };
}

export async function recordSkippedAction(context, taskId, note) {
  await requireStatus(context);
  await appendEvent(context, { type: 'skipped-action', task: taskId ?? null, detail: note });
  return { recorded: 'skipped-action' };
}

function transition(status, input) {
  try {
    return applyResult(status, input);
  } catch (error) {
    if (error instanceof TransitionError) throw new CliError(error.message);
    throw error;
  }
}

async function afterTransition(context, { status, activated }, now) {
  const next = activated ? await switchAndRecord(context, status, activated) : status;
  await writeStatus(context, { ...next, heartbeat: now });
  if (activated) await appendEvent(context, { type: 'task-start', task: activated.id, detail: activated.failedDependencies.length ? `phụ thuộc task chưa done: ${activated.failedDependencies.join(', ')}` : '' });
  return next;
}

async function switchAndRecord(context, status, activated) {
  const { branch, baseBranch } = switchToTaskBranch(context, activated.id);
  return {
    ...status,
    tasks: status.tasks.map((task) => (task.id === activated.id ? { ...task, branch, baseBranch } : task)),
  };
}

function describeTask(context, status, taskId) {
  const task = status.tasks?.find((candidate) => candidate.id === taskId);
  return {
    spec: context.specPath,
    worktree: context.worktreePath,
    pmTasks: context.pmTasksPath,
    ...(task ? { title: task.title, acs: task.acs, lastFailure: task.lastFailure, lockedFiles: task.lock?.files ?? [], branch: task.branch } : {}),
  };
}

async function requireStatus(context) {
  const status = await readStatus(context);
  if (!status) throw new CliError(`Spec chưa được bắt đầu (thiếu status.json). Chạy: run start ${context.specDir}`);
  return status;
}

async function readPmTasks(context) {
  const content = await readFile(context.pmTasksPath, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (content === null) return { parseError: `Thiếu ${context.pmTasksPath}` };
  try {
    return { value: JSON.parse(content) };
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { parseError: `pm-tasks.json không phải JSON hợp lệ: ${error.message}` };
  }
}
