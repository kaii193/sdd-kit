import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyResult,
  createStatus,
  loadTasks,
  MAX_PM_ATTEMPTS,
  nextAction,
  recordPmFailure,
  resetFailedTasks,
  resumeRun,
  TransitionError,
  validatePmTasks,
} from '../../lib/engine/state-machine.js';

const NOW = '2026-09-29T10:00:00.000Z';
const LIMITS = { maxAgentCallsPerRun: 150 };
const LOCK = { commit: 'abc', files: ['test/pricing.test.js'], tests: 2, assertions: 2 };

function freshStatus() {
  return createStatus({ project: 'shop', spec: '001-x', specHash: 'h1', branch: 'feat/001-x', worktree: '/w', now: NOW });
}

function withTasks(tasks = [{ id: 'P1', title: 'Áp mã', acs: ['AC-1'] }, { id: 'P2', title: 'Từ chối mã', acs: ['AC-2'] }]) {
  return loadTasks(freshStatus(), { tasks }).status;
}

function step(status, task, stepName, result, extra = {}) {
  return applyResult(status, { task, step: stepName, result, note: `${stepName} ${result}`, ...extra }).status;
}

function toImplement(status, task = 'P1') {
  const stubbed = step(status, task, 'stub', 'pass', { commit: 's1' });
  const tested = step(stubbed, task, 'tests', 'pass', { commit: 't1' });
  return step(tested, task, 'lock', 'pass', { lock: LOCK });
}

function failRound(status, task = 'P1') {
  return step(status, task, 'implement', 'fail');
}

function task(status, id) {
  return status.tasks.find((candidate) => candidate.id === id);
}

test('asks the PM for tasks before anything else', () => {
  assert.deepEqual(nextAction(freshStatus(), LIMITS), { kind: 'agent', agent: 'gf-pm', step: 'plan' });
});

test('starts the first task at the stub step with the coder', () => {
  const action = nextAction(withTasks(), LIMITS);

  assert.equal(action.agent, 'gf-coder');
  assert.equal(action.step, 'stub');
  assert.equal(action.task, 'P1');
});

test('walks stub, tests, lock, implement, gate, review, qc in order', () => {
  const order = [];
  let status = withTasks();
  for (const [stepName, extra] of [['stub', { commit: 's' }], ['tests', { commit: 't' }], ['lock', { lock: LOCK }], ['implement', {}], ['gate', {}], ['review', {}], ['qc', {}]]) {
    order.push(nextAction(status, LIMITS).step);
    status = step(status, 'P1', stepName, 'pass', extra);
  }

  assert.deepEqual(order, ['stub', 'tests', 'lock', 'implement', 'gate', 'review', 'qc']);
  assert.equal(task(status, 'P1').state, 'done');
  assert.equal(task(status, 'P1').round, 1);
});

test('stops at the first round that passes', () => {
  let status = failRound(toImplement(withTasks()));
  status = ['implement', 'gate', 'review', 'qc'].reduce((current, stepName) => step(current, 'P1', stepName, 'pass'), status);

  assert.equal(task(status, 'P1').state, 'done');
  assert.equal(task(status, 'P1').round, 2);
});

test('fails a task after exactly three rounds and moves on to the next one', () => {
  let status = toImplement(withTasks());
  status = failRound(status);
  status = failRound(status);
  assert.equal(task(status, 'P1').round, 3);
  status = failRound(status);

  assert.equal(task(status, 'P1').state, 'failed');
  assert.equal(nextAction(status, LIMITS).task, 'P2');
});

test('counts gate, review and qc rejections as rounds too', () => {
  let status = toImplement(withTasks());
  status = step(step(status, 'P1', 'implement', 'pass'), 'P1', 'gate', 'fail');
  status = step(step(step(status, 'P1', 'implement', 'pass'), 'P1', 'gate', 'pass'), 'P1', 'review', 'fail');
  status = step(step(step(step(status, 'P1', 'implement', 'pass'), 'P1', 'gate', 'pass'), 'P1', 'review', 'pass'), 'P1', 'qc', 'fail');

  assert.equal(task(status, 'P1').state, 'failed');
});

test('marks the spec failed when every task is finished and one failed', () => {
  let status = toImplement(withTasks());
  status = failRound(failRound(failRound(status)));
  status = toImplement(status, 'P2');
  status = ['implement', 'gate', 'review', 'qc'].reduce((current, stepName) => step(current, 'P2', stepName, 'pass'), status);

  assert.equal(status.state, 'failed');
  assert.deepEqual(nextAction(status, LIMITS), { kind: 'finished', state: 'failed' });
});

test('marks the spec done when every task is done', () => {
  let status = withTasks([{ id: 'P1', title: 'Áp mã', acs: ['AC-1'] }]);
  status = toImplement(status);
  status = ['implement', 'gate', 'review', 'qc'].reduce((current, stepName) => step(current, 'P1', stepName, 'pass'), status);

  assert.equal(status.state, 'done');
});

test('blocks the whole spec on an infrastructure failure without spending a round', () => {
  const implementing = toImplement(withTasks());
  const status = step(step(implementing, 'P1', 'implement', 'pass'), 'P1', 'gate', 'blocked');

  assert.equal(status.state, 'blocked');
  assert.equal(task(status, 'P1').round, 1);
  assert.equal(task(status, 'P1').step, 'gate');
});

test('resumes a blocked spec at the same step', () => {
  const blocked = step(step(toImplement(withTasks()), 'P1', 'implement', 'pass'), 'P1', 'gate', 'blocked');

  const resumed = resumeRun(blocked, NOW);

  assert.equal(resumed.state, 'in-progress');
  assert.equal(nextAction(resumed, LIMITS).command, 'gate');
});

test('never attempts a task the PM flagged as needing a forbidden action', () => {
  const status = withTasks([
    { id: 'P1', title: 'Đổi schema', acs: ['AC-1'], policy: 'migration' },
    { id: 'P2', title: 'Từ chối mã', acs: ['AC-2'] },
  ]);

  assert.equal(task(status, 'P1').state, 'blocked_by_policy');
  assert.equal(nextAction(status, LIMITS).task, 'P2');
});

test('sends QC back once when tests pass before implementation, then continues with a weak lock', () => {
  let status = step(step(withTasks(), 'P1', 'stub', 'pass', { commit: 's' }), 'P1', 'tests', 'pass', { commit: 't' });
  status = step(status, 'P1', 'lock', 'fail', { lock: LOCK });
  assert.equal(nextAction(status, LIMITS).step, 'tests');
  status = step(step(status, 'P1', 'tests', 'pass', { commit: 't2' }), 'P1', 'lock', 'fail', { lock: LOCK });

  assert.equal(nextAction(status, LIMITS).step, 'implement');
  assert.equal(task(status, 'P1').weakLock, true);
});

test('fails a task after three failed setup attempts', () => {
  let status = withTasks();
  status = step(status, 'P1', 'stub', 'fail');
  status = step(status, 'P1', 'stub', 'fail');
  status = step(status, 'P1', 'stub', 'fail');

  assert.equal(task(status, 'P1').state, 'failed');
});

test('rejects a result for a step that is not the current one', () => {
  assert.throws(() => applyResult(withTasks(), { task: 'P1', step: 'qc', result: 'pass' }), TransitionError);
  assert.throws(() => applyResult(withTasks(), { task: 'P2', step: 'stub', result: 'pass' }), TransitionError);
});

test('pauses when the agent call cap for this run is reached', () => {
  const status = { ...withTasks(), runAgentCalls: 2 };

  assert.deepEqual(nextAction(status, { maxAgentCallsPerRun: 2 }), { kind: 'pause', reason: 'agent-call-cap' });
  assert.equal(nextAction(resumeRun(status, NOW), { maxAgentCallsPerRun: 2 }).kind, 'agent');
});

test('notes when a task starts although a task it depends on is not done', () => {
  let status = withTasks([
    { id: 'P1', title: 'Nền', acs: ['AC-1'] },
    { id: 'P2', title: 'Dùng nền', acs: ['AC-2'], dependsOn: ['P1'] },
  ]);
  status = toImplement(status);
  const { activated } = applyResult(failRound(failRound(status)), { task: 'P1', step: 'implement', result: 'fail' });

  assert.equal(activated.id, 'P2');
  assert.deepEqual(activated.failedDependencies, ['P1']);
});

test('puts failed tasks back in the queue when the spec changes', () => {
  let status = toImplement(withTasks([{ id: 'P1', title: 'Áp mã', acs: ['AC-1'] }]));
  status = failRound(failRound(failRound(status)));
  assert.equal(status.state, 'failed');

  const { status: reset } = resetFailedTasks(status, 'h2');

  assert.equal(reset.state, 'in-progress');
  assert.equal(reset.specHash, 'h2');
  assert.equal(task(reset, 'P1').round, 0);
  assert.equal(nextAction(reset, LIMITS).step, 'stub');
});

test('blocks the spec after the PM fails to produce valid tasks three times', () => {
  let status = freshStatus();
  for (let attempt = 1; attempt < MAX_PM_ATTEMPTS; attempt += 1) {
    status = recordPmFailure(status, 'thiếu AC-2').status;
    assert.equal(status.state, 'in-progress');
  }
  status = recordPmFailure(status, 'thiếu AC-2').status;

  assert.equal(status.state, 'blocked');
  assert.match(status.blockedReason, /thiếu AC-2/);
});

test('rejects PM tasks that leave an AC uncovered or reference an unknown AC', () => {
  const errors = validatePmTasks({ tasks: [{ id: 'P1', title: 'Áp mã', acs: ['AC-1', 'AC-9'] }] }, ['AC-1', 'AC-2']);

  assert.ok(errors.includes('P1: AC-9 không có trong spec'));
  assert.ok(errors.includes('AC-2 không thuộc PM task nào'));
});

test('rejects PM tasks with bad ids, duplicates or forward dependencies', () => {
  const errors = validatePmTasks(
    {
      tasks: [
        { id: 'task-1', title: 'A', acs: ['AC-1'] },
        { id: 'P2', title: 'B', acs: ['AC-1'], dependsOn: ['P3'] },
        { id: 'P2', title: 'C', acs: ['AC-1'] },
      ],
    },
    ['AC-1'],
  );

  assert.ok(errors.some((error) => error.includes("id không hợp lệ: 'task-1'")));
  assert.ok(errors.includes('id bị trùng: P2'));
  assert.ok(errors.includes('P2: dependsOn P3 phải là task đứng trước'));
});
