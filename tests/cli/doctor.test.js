import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createProject, installInto, readProjectFile, runCli } from './helpers.js';

const UNFILLED_COMMAND = /`\.\.\.`/g;

function doctor(project, { autonomous = false, env = {} } = {}) {
  return runCli(['doctor', '--directory', project, ...(autonomous ? ['--autonomous'] : [])], { env });
}

function fillProjectCommands(project) {
  const agentsPath = path.join(project, 'AGENTS.md');
  writeFileSync(agentsPath, readProjectFile(project, 'AGENTS.md').replace(UNFILLED_COMMAND, '`npm test`'));
}

function createReadyProject(t) {
  const project = createProject(t);
  installInto(project);
  fillProjectCommands(project);
  mkdirSync(path.join(project, 'src'));
  return project;
}

test('flags unfilled project commands on a fresh install', (t) => {
  const project = createProject(t);
  installInto(project);

  const result = doctor(project);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /✗ AGENTS\.md mục 7/);
});

test('flags module globs that match no folder', (t) => {
  const project = createProject(t);
  installInto(project);
  fillProjectCommands(project);

  const result = doctor(project);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /✗ MODULE_GLOBS.*Không có thư mục: src/);
});

test('passes the base checks once commands are filled and module folders exist', (t) => {
  const project = createReadyProject(t);

  const result = doctor(project, { env: { TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '' } });

  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /✓ AGENTS\.md mục 7/);
  assert.match(result.stdout, /✓ MODULE_GLOBS/);
  assert.match(result.stdout, /! Biến môi trường TELEGRAM_CHAT_ID \(chế độ độc lập\)/);
});

test('flags a folder that is not a git repository', (t) => {
  const project = createProject(t, { git: false });
  installInto(project);

  const result = doctor(project);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /✗ Git repository/);
});

test('flags a project where the kit is not installed', (t) => {
  const project = createProject(t);

  const result = doctor(project);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /✗ Đã cài kit/);
});

test('requires Telegram variables in autonomous mode without printing their values', (t) => {
  const project = createReadyProject(t);
  const token = 'secret-token-123';

  const result = doctor(project, { autonomous: true, env: { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: '' } });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /✓ Biến môi trường TELEGRAM_BOT_TOKEN/);
  assert.match(result.stdout, /✗ Biến môi trường TELEGRAM_CHAT_ID/);
  assert.ok(!result.stdout.includes(token));
  assert.match(result.stdout, /Tự đối chiếu/);
});
