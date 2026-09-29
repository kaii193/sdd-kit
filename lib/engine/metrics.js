import { TaskState } from './state-machine.js';

export function computeMetrics(runs) {
  const tasks = runs.flatMap((run) => run.status.tasks ?? []);
  const finished = tasks.filter((task) => [TaskState.Done, TaskState.Failed].includes(task.state));
  const doneFirstRound = tasks.filter((task) => task.state === TaskState.Done && task.round === 1);
  const events = runs.flatMap((run) => run.events);
  const count = (state) => tasks.filter((task) => task.state === state).length;
  return {
    specs: runs.length,
    specsBlocked: runs.filter((run) => run.status.state === 'blocked').length,
    tasks: tasks.length,
    done: count(TaskState.Done),
    failed: count(TaskState.Failed),
    blockedByPolicy: count(TaskState.BlockedByPolicy),
    doneFirstRoundRate: ratio(doneFirstRound.length, finished.length),
    averageRounds: finished.length ? round2(finished.reduce((sum, task) => sum + task.round, 0) / finished.length) : 0,
    agentCallsPerTask: tasks.length ? round2(runs.reduce((sum, run) => sum + run.status.agentCalls, 0) / tasks.length) : 0,
    qcTestEdits: events.filter((event) => event.type === 'relock' && event.result === 'pass').length,
    assumptions: events.filter((event) => event.type === 'assumption').length,
  };
}

function ratio(part, whole) {
  return whole ? round2(part / whole) : 0;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}
