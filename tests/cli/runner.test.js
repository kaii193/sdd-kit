import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { DENY_RULES } from '../../lib/installer.js';
import { AC1_TEST, createEngine, git, PRICING, SPEC, STUB } from './engine-fixture.js';
import { createSandbox, install, readJson, readText, runCli, toPosix, writeText } from './helpers.js';

const THREE_HOURS_AGO = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

test('installs the deny rules into the gf home settings', (t) => {
  const sandbox = createSandbox(t);

  install(sandbox);

  assert.deepEqual(readJson(path.join(sandbox.home, '.claude/settings.json')).permissions.deny, DENY_RULES);
});

test('installs runner.md with the absolute CLI path rendered', (t) => {
  const sandbox = createSandbox(t);

  install(sandbox);

  const runner = readText(path.join(sandbox.home, 'runner.md'));
  assert.ok(!runner.includes('{{'));
  assert.ok(runner.includes(`node "${toPosix(path.join(sandbox.claude, 'gf/kit/bin/gf.js'))}" run scan`));
  assert.match(runner, /Không tích ô worktree/);
});

test('flags missing deny rules only when checking for autonomous mode', (t) => {
  const engine = createEngine(t);
  const settingsPath = path.join(engine.sandbox.home, '.claude/settings.json');
  const settings = readJson(settingsPath);
  writeText(settingsPath, JSON.stringify({ ...settings, permissions: { ...settings.permissions, deny: [] } }));
  const constitution = path.join(engine.sandbox.home, 'projects/shop/constitution.md');
  writeText(constitution, readText(constitution).replace('### 4.5 Quyết định mặc định cho agent', '### 4.5 Quyết định mặc định cho agent\n- Dùng lại code có sẵn'));
  const env = { TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_CHAT_ID: 'y' };

  const interactive = runCli(engine.sandbox, ['doctor', '--directory', engine.sandbox.home], { env });
  const autonomous = runCli(engine.sandbox, ['doctor', '--directory', engine.sandbox.home, '--autonomous'], { env });

  assert.match(interactive.stdout, /! Danh sách cấm/);
  assert.match(autonomous.stdout, /✗ Danh sách cấm .* — Thiếu: Bash\(git push --force \*\)/);
  assert.equal(autonomous.status, 1);
});

test('resumes at the same step after a run died mid-task', (t) => {
  const engine = createEngine(t);
  engine.startWithTasks();
  engine.commit({ [PRICING]: STUB }, 'stub');
  engine.record('P1', 'stub', 'pass');
  const statusPath = path.join(engine.sandbox.home, SPEC, 'status.json');
  writeText(statusPath, JSON.stringify({ ...engine.status(), heartbeat: THREE_HOURS_AGO(), runAgentCalls: 7 }));

  const scan = engine.run(['scan']).json[0];
  engine.run(['start', SPEC]);
  const next = engine.run(['next', SPEC]).json;

  assert.equal(scan.action, 'resume');
  assert.equal(next.step, 'tests');
  assert.equal(next.task, 'P1');
  assert.equal(engine.status().runAgentCalls, 0);
});

test('skips a spec that another session is working on right now', (t) => {
  const engine = createEngine(t);
  engine.startWithTasks();

  assert.equal(engine.run(['scan']).json[0].action, 'skip');
});

test('recreates a deleted worktree on the branch of the task in progress', (t) => {
  const engine = createEngine(t);
  engine.startWithTasks();
  engine.reachImplement('P1', { testFile: 'test/pricing-promo.test.js', testContent: AC1_TEST });
  const worktree = engine.worktree();
  rmSync(worktree, { recursive: true, force: true });

  const start = engine.run(['start', SPEC]);

  assert.equal(start.status, 0, start.stderr);
  assert.ok(existsSync(path.join(worktree, 'test/pricing-promo.test.js')));
  assert.equal(git(worktree, ['rev-parse', '--abbrev-ref', 'HEAD']), 'feat/001-ap-ma-giam-gia-p1');
});

test('lists skipped forbidden actions and assumptions in the summary', (t) => {
  const engine = createEngine(t);
  engine.startWithTasks();
  engine.run(['skip-action', SPEC, '--task', 'P1', '--note', 'Cần chạy migration thêm cột promo_code']);
  engine.run(['assume', SPEC, '--task', 'P1', '--note', 'Mã phân biệt hoa thường theo Q1']);

  engine.run(['summary', SPEC]);

  const summary = readText(path.join(engine.sandbox.home, SPEC, 'runs/summary.md'));
  assert.match(summary, /Hành động bị bỏ qua vì bị cấm \(1\)\n- Cần chạy migration thêm cột promo_code/);
  assert.match(summary, /Giả định agent tự chọn \(1\)\n- P1: Mã phân biệt hoa thường theo Q1/);
});
