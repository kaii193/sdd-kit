import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  createCodeRepo,
  createSandbox,
  install,
  linkProject,
  projectPath,
  readJson,
  readText,
  runCli,
  writeText,
} from './helpers.js';

const NO_TELEGRAM = { TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '' };

function doctor(sandbox, { autonomous = false, env = NO_TELEGRAM } = {}) {
  return runCli(sandbox, ['doctor', '--directory', sandbox.home, ...(autonomous ? ['--autonomous'] : [])], { env });
}

function fillProject(sandbox, name) {
  const configPath = projectPath(sandbox, name, 'config.sh');
  writeText(
    configPath,
    readText(configPath).replace('TEST_COMMAND=""', 'TEST_COMMAND="npm test"').replace('LINT_COMMAND=""', 'LINT_COMMAND="npm run lint"'),
  );
  const constitutionPath = projectPath(sandbox, name, 'constitution.md');
  writeText(
    constitutionPath,
    readText(constitutionPath).replace(
      '### 4.5 Quyết định mặc định cho agent',
      '### 4.5 Quyết định mặc định cho agent\n- Ưu tiên dùng lại code có sẵn',
    ),
  );
}

function createReadyHome(t) {
  const sandbox = createSandbox(t);
  install(sandbox);
  const repo = createCodeRepo(sandbox, 'shop-api');
  linkProject(sandbox, 'shop-api', repo);
  fillProject(sandbox, 'shop-api');
  return { sandbox, repo };
}

test('passes once the linked project is filled in', (t) => {
  const { sandbox } = createReadyHome(t);

  const result = doctor(sandbox);

  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /✓ \[shop-api\] Lệnh TEST_COMMAND, LINT_COMMAND đã điền/);
  assert.match(result.stdout, /✓ \[shop-api\] constitution\.md mục 4\.5/);
  assert.match(result.stdout, /! Biến môi trường TELEGRAM_CHAT_ID \(chế độ độc lập\)/);
});

test('flags empty commands and empty default decisions right after /gf-init', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);
  linkProject(sandbox, 'shop-api', createCodeRepo(sandbox, 'shop-api'));

  const result = doctor(sandbox);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /✗ \[shop-api\] Lệnh TEST_COMMAND, LINT_COMMAND đã điền — Còn trống: TEST_COMMAND, LINT_COMMAND/);
  assert.match(result.stdout, /✗ \[shop-api\] constitution\.md mục 4\.5/);
});

test('flags module globs that match no folder in the code repo', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);
  linkProject(sandbox, 'shop-api', createCodeRepo(sandbox, 'shop-api', { folders: ['lib'] }));
  fillProject(sandbox, 'shop-api');

  const result = doctor(sandbox);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /✗ \[shop-api\] MODULE_GLOBS.*Không có thư mục: src/);
});

test('flags a linked repo that no longer exists', (t) => {
  const { sandbox, repo } = createReadyHome(t);
  rmSync(repo, { recursive: true, force: true });

  const result = doctor(sandbox);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /✗ \[shop-api\] Repo code tồn tại và là git repo/);
});

test('flags a linked repo missing from additionalDirectories', (t) => {
  const { sandbox } = createReadyHome(t);
  const settingsPath = path.join(sandbox.home, '.claude/settings.json');
  const settings = readJson(settingsPath);
  settings.permissions.additionalDirectories = [];
  writeText(settingsPath, JSON.stringify(settings));

  const result = doctor(sandbox);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /✗ \[shop-api\] Repo code có trong additionalDirectories/);
});

test('flags a settings.json that is not valid JSON instead of hiding it', (t) => {
  const { sandbox } = createReadyHome(t);
  writeText(path.join(sandbox.home, '.claude/settings.json'), '{ hỏng');

  const result = doctor(sandbox);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /✗ \.claude\/settings\.json là JSON hợp lệ — .*không phải JSON hợp lệ/);
});

test('flags a missing skill', (t) => {
  const { sandbox } = createReadyHome(t);
  rmSync(path.join(sandbox.claude, 'skills/gf-spec'), { recursive: true, force: true });

  const result = doctor(sandbox);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /✗ Skill, agent và CLI .* — Thiếu: skill gf-spec/);
});

test('only warns when no project is linked yet', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);

  const result = doctor(sandbox);

  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /! Dự án đã link — Chưa có/);
});

test('flags a folder that is not a gf home', (t) => {
  const sandbox = createSandbox(t);
  createCodeRepo(sandbox, 'x');

  const result = runCli(sandbox, ['doctor', '--directory', sandbox.root], { env: NO_TELEGRAM });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /✗ Thư mục gốc gf/);
});

test('requires Telegram variables in autonomous mode without printing their values', (t) => {
  const { sandbox } = createReadyHome(t);
  const token = 'secret-token-123';

  const result = doctor(sandbox, { autonomous: true, env: { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: '' } });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /✓ Biến môi trường TELEGRAM_BOT_TOKEN/);
  assert.match(result.stdout, /✗ Biến môi trường TELEGRAM_CHAT_ID/);
  assert.ok(!result.stdout.includes(token));
  assert.match(result.stdout, /KHÔNG tích worktree/);
});
