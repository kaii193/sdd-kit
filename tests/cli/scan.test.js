import assert from 'node:assert/strict';
import test from 'node:test';
import { decideScanAction } from '../../lib/engine/scan.js';

const NOW = '2026-09-29T12:00:00.000Z';

function minutesAgo(minutes) {
  return new Date(Date.parse(NOW) - minutes * 60_000).toISOString();
}

function decide(status, { specStatus = 'approved', specHash = 'h1' } = {}) {
  return decideScanAction({ specStatus, status, specHash, now: NOW });
}

test('skips a spec that is not approved yet', () => {
  assert.equal(decide(null, { specStatus: 'draft' }).action, 'skip');
});

test('starts an approved spec that was never run', () => {
  assert.equal(decide(null).action, 'start');
});

test('skips a spec whose heartbeat is 30 minutes old', () => {
  const decision = decide({ state: 'in-progress', heartbeat: minutesAgo(30) });

  assert.equal(decision.action, 'skip');
  assert.match(decision.reason, /đang chạy/);
});

test('resumes a spec whose heartbeat is 120 minutes old', () => {
  assert.equal(decide({ state: 'in-progress', heartbeat: minutesAgo(120) }).action, 'resume');
});

test('resumes a blocked spec every run and asks to report it only once', () => {
  const first = decide({ state: 'blocked', blockedReason: 'lint hỏng', reported: null });
  const later = decide({ state: 'blocked', blockedReason: 'lint hỏng', reported: 'blocked' });

  assert.equal(first.action, 'resume');
  assert.equal(first.notify, true);
  assert.equal(later.action, 'resume');
  assert.equal(later.notify, false);
});

test('restarts a failed spec after spec.md was edited', () => {
  assert.equal(decide({ state: 'failed', specHash: 'h1', reported: 'failed' }, { specHash: 'h2' }).action, 'restart-failed');
});

test('reports a failed spec once and then leaves it alone while spec.md is unchanged', () => {
  assert.equal(decide({ state: 'failed', specHash: 'h1', reported: null }).action, 'report');
  assert.equal(decide({ state: 'failed', specHash: 'h1', reported: 'failed' }).action, 'skip');
});

test('reports a done spec once and then leaves it alone', () => {
  assert.equal(decide({ state: 'done', specHash: 'h1', reported: null }).action, 'report');
  assert.equal(decide({ state: 'done', specHash: 'h1', reported: 'done' }).action, 'skip');
});
