export const MAX_ROUNDS = 3;
export const MAX_SETUP_FAILURES = 3;
export const MAX_PM_ATTEMPTS = 3;
export const MAX_RED_RETRIES = 1;

export const SpecState = { InProgress: 'in-progress', Done: 'done', Failed: 'failed', Blocked: 'blocked' };
export const TaskState = {
  Pending: 'pending',
  Active: 'active',
  Done: 'done',
  Failed: 'failed',
  BlockedByPolicy: 'blocked_by_policy',
};
export const Step = {
  Stub: 'stub',
  Tests: 'tests',
  Lock: 'lock',
  Implement: 'implement',
  Gate: 'gate',
  Review: 'review',
  Qc: 'qc',
};
export const Result = { Pass: 'pass', Fail: 'fail', Blocked: 'blocked', Policy: 'policy' };

const AGENT_BY_STEP = {
  [Step.Stub]: 'gf-coder',
  [Step.Tests]: 'gf-qc',
  [Step.Implement]: 'gf-coder',
  [Step.Review]: 'gf-reviewer',
  [Step.Qc]: 'gf-qc',
};
const MACHINE_STEPS = [Step.Lock, Step.Gate];
const TERMINAL_TASK_STATES = [TaskState.Done, TaskState.Failed, TaskState.BlockedByPolicy];
const TASK_ID_PATTERN = /^P\d+$/;

export class TransitionError extends Error {}

export function createStatus({ project, spec, specHash, branch, worktree, now }) {
  return {
    version: 1,
    project,
    spec,
    state: SpecState.InProgress,
    specHash,
    branch,
    worktree,
    startedAt: now,
    heartbeat: now,
    reported: null,
    agentCalls: 0,
    runAgentCalls: 0,
    pmAttempts: 0,
    tasks: null,
    blockedReason: null,
  };
}

export function nextAction(status, { maxAgentCallsPerRun }) {
  if (status.state !== SpecState.InProgress) return { kind: 'finished', state: status.state };
  if (status.runAgentCalls >= maxAgentCallsPerRun) return { kind: 'pause', reason: 'agent-call-cap' };
  if (!status.tasks) return { kind: 'agent', agent: 'gf-pm', step: 'plan' };
  const task = activeTask(status);
  if (!task) return { kind: 'finished', state: status.state };
  const base = { task: task.id, round: task.round, step: task.step };
  if (MACHINE_STEPS.includes(task.step)) return { kind: 'machine', command: task.step, ...base };
  return { kind: 'agent', agent: AGENT_BY_STEP[task.step], ...base };
}

export function validatePmTasks(pmTasks, specAcs) {
  const tasks = Array.isArray(pmTasks?.tasks) ? pmTasks.tasks : null;
  if (!tasks?.length) return ['pm-tasks.json phải có mảng "tasks" không rỗng'];
  const ids = tasks.map((task) => task.id);
  const covered = new Set(tasks.flatMap((task) => task.acs ?? []));
  return [
    ...tasks.filter((task) => !TASK_ID_PATTERN.test(task.id ?? '')).map((task) => `id không hợp lệ: '${task.id}' (dạng P1, P2…)`),
    ...ids.filter((id, index) => ids.indexOf(id) !== index).map((id) => `id bị trùng: ${id}`),
    ...tasks.filter((task) => !task.title).map((task) => `${task.id}: thiếu title`),
    ...tasks.filter((task) => !task.acs?.length).map((task) => `${task.id}: thiếu acs`),
    ...tasks.flatMap((task) => (task.acs ?? []).filter((ac) => !specAcs.includes(ac)).map((ac) => `${task.id}: ${ac} không có trong spec`)),
    ...tasks.flatMap((task, index) =>
      (task.dependsOn ?? []).filter((dependency) => !ids.slice(0, index).includes(dependency)).map(
        (dependency) => `${task.id}: dependsOn ${dependency} phải là task đứng trước`,
      ),
    ),
    ...specAcs.filter((ac) => !covered.has(ac)).map((ac) => `${ac} không thuộc PM task nào`),
  ];
}

export function loadTasks(status, pmTasks) {
  const tasks = pmTasks.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    acs: task.acs,
    dependsOn: task.dependsOn ?? [],
    policy: task.policy ?? null,
    state: task.policy ? TaskState.BlockedByPolicy : TaskState.Pending,
    step: null,
    round: 0,
    setupFailures: 0,
    redRetries: 0,
    lastFailure: task.policy ? `cần hành động bị cấm: ${task.policy}` : null,
  }));
  return advance({ ...status, tasks });
}

export function recordPmFailure(status, reason) {
  const pmAttempts = status.pmAttempts + 1;
  const counted = { ...countAgentCall(status), pmAttempts };
  if (pmAttempts < MAX_PM_ATTEMPTS) return { status: counted, activated: null };
  return { status: blockSpec(counted, `PM không tạo được pm-tasks.json hợp lệ sau ${pmAttempts} lần: ${reason}`), activated: null };
}

export function applyResult(status, input) {
  const task = activeTask(status);
  if (!task || task.id !== input.task || task.step !== input.step) {
    const current = task ? `${task.id}/${task.step}` : 'không có task đang chạy';
    throw new TransitionError(`Không ở bước ${input.task}/${input.step} (hiện: ${current})`);
  }
  const counted = AGENT_BY_STEP[input.step] ? countAgentCall(status) : status;
  if (input.result === Result.Blocked) return { status: blockSpec(counted, input.note), activated: null };
  if (input.result === Result.Policy) {
    return advance(updateTask(counted, task.id, { state: TaskState.BlockedByPolicy, step: null, lastFailure: input.note }));
  }
  const handler = STEP_HANDLERS[input.step];
  return advance(updateTask(counted, task.id, handler(task, input)));
}

const STEP_HANDLERS = {
  [Step.Stub]: (task, input) =>
    input.result === Result.Pass ? { step: Step.Tests, stubCommit: input.commit } : setupFailure(task, input),
  [Step.Tests]: (task, input) =>
    input.result === Result.Pass ? { step: Step.Lock, testsCommit: input.commit } : setupFailure(task, input),
  [Step.Lock]: (task, input) => {
    if (input.result === Result.Pass) return { step: Step.Implement, round: 1, lock: input.lock };
    if (task.redRetries < MAX_RED_RETRIES) return { step: Step.Tests, redRetries: task.redRetries + 1, lastFailure: input.note };
    return { step: Step.Implement, round: 1, lock: input.lock, weakLock: true, lastFailure: input.note };
  },
  [Step.Implement]: (task, input) => (input.result === Result.Pass ? { step: Step.Gate } : roundFailure(task, input)),
  [Step.Gate]: (task, input) => (input.result === Result.Pass ? { step: Step.Review } : roundFailure(task, input)),
  [Step.Review]: (task, input) => (input.result === Result.Pass ? { step: Step.Qc } : roundFailure(task, input)),
  [Step.Qc]: (task, input) =>
    input.result === Result.Pass ? { state: TaskState.Done, step: null, lastFailure: null } : roundFailure(task, input),
};

function setupFailure(task, input) {
  const setupFailures = task.setupFailures + 1;
  if (setupFailures < MAX_SETUP_FAILURES) return { setupFailures, lastFailure: input.note };
  return { setupFailures, state: TaskState.Failed, step: null, lastFailure: input.note };
}

function roundFailure(task, input) {
  if (task.round < MAX_ROUNDS) return { round: task.round + 1, step: Step.Implement, lastFailure: input.note };
  return { state: TaskState.Failed, step: null, lastFailure: input.note };
}

function advance(status) {
  if (activeTask(status)) return { status, activated: null };
  const next = status.tasks.find((task) => task.state === TaskState.Pending);
  if (next) {
    const failedDependencies = next.dependsOn.filter((id) =>
      status.tasks.some((task) => task.id === id && task.state !== TaskState.Done),
    );
    const activated = { ...next, state: TaskState.Active, step: Step.Stub, failedDependencies };
    return { status: updateTask(status, next.id, activated), activated };
  }
  const allDone = status.tasks.every((task) => task.state === TaskState.Done);
  return { status: { ...status, state: allDone ? SpecState.Done : SpecState.Failed }, activated: null };
}

export function resetFailedTasks(status, specHash) {
  const tasks = status.tasks?.map((task) =>
    task.state === TaskState.Failed
      ? { ...task, state: TaskState.Pending, step: null, round: 0, setupFailures: 0, redRetries: 0, lock: undefined, lastFailure: null }
      : task,
  );
  return advance({ ...status, state: SpecState.InProgress, specHash, tasks, blockedReason: null });
}

export function resumeRun(status, now) {
  const resumed = { ...status, heartbeat: now, runAgentCalls: 0 };
  return status.state === SpecState.Blocked ? { ...resumed, state: SpecState.InProgress, blockedReason: null } : resumed;
}

export function isTerminalTask(task) {
  return TERMINAL_TASK_STATES.includes(task.state);
}

function activeTask(status) {
  return status.tasks?.find((task) => task.state === TaskState.Active) ?? null;
}

function updateTask(status, taskId, changes) {
  return { ...status, tasks: status.tasks.map((task) => (task.id === taskId ? { ...task, ...changes } : task)) };
}

function countAgentCall(status) {
  return { ...status, agentCalls: status.agentCalls + 1, runAgentCalls: status.runAgentCalls + 1 };
}

function blockSpec(status, reason) {
  return { ...status, state: SpecState.Blocked, blockedReason: reason ?? 'không rõ lý do' };
}
