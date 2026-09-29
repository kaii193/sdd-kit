import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  createCodeRepo,
  createSandbox,
  exists,
  install,
  linkProject,
  projectPath,
  readJson,
  readText,
  runCli,
  toPosix,
  writeText,
} from './helpers.js';

function settingsPath(sandbox) {
  return path.join(sandbox.home, '.claude/settings.json');
}

test('creates a project folder linked to the code repo', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);
  const repo = createCodeRepo(sandbox, 'shop-api');

  const result = linkProject(sandbox, 'shop-api', repo);

  assert.equal(result.status, 0, result.stderr);
  const config = readText(projectPath(sandbox, 'shop-api', 'config.sh'));
  assert.ok(config.includes(`PROJECT_PATH="${toPosix(repo)}"`));
  assert.match(config, /^BASE_BRANCH="[^"{}]+"$/m);
  assert.match(readText(projectPath(sandbox, 'shop-api', 'constitution.md')), /### 4\.5 Quyết định mặc định cho agent/);
  for (const file of ['patterns.md', 'decisions/adr-template.md', 'specs']) {
    assert.ok(exists(projectPath(sandbox, 'shop-api', file)), `thiếu ${file}`);
  }
});

test('adds the repo to additionalDirectories and keeps the other settings', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);
  writeText(settingsPath(sandbox), JSON.stringify({ model: 'opus', permissions: { allow: ['Bash(ls)'] } }));
  const repo = createCodeRepo(sandbox, 'shop-api');

  linkProject(sandbox, 'shop-api', repo);

  const settings = readJson(settingsPath(sandbox));
  assert.equal(settings.model, 'opus');
  assert.deepEqual(settings.permissions.allow, ['Bash(ls)']);
  assert.deepEqual(settings.permissions.additionalDirectories, [toPosix(repo)]);
});

test('rejects a folder that is not a git repository', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);

  const result = linkProject(sandbox, 'shop-api', createCodeRepo(sandbox, 'shop-api', { git: false }));

  assert.equal(result.status, 1);
  assert.match(result.stderr, /không phải git repo/);
  assert.ok(!exists(projectPath(sandbox, 'shop-api')));
});

test('rejects a project name that is not a lowercase slug', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);

  const result = linkProject(sandbox, 'Shop API', createCodeRepo(sandbox, 'shop-api'));

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Tên dự án không hợp lệ/);
});

test('rejects a name that is already used', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);
  linkProject(sandbox, 'shop-api', createCodeRepo(sandbox, 'shop-api'));

  const result = linkProject(sandbox, 'shop-api', createCodeRepo(sandbox, 'shop-web'));

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Dự án 'shop-api' đã tồn tại/);
});

test('rejects a repo that is already linked under another name', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);
  const repo = createCodeRepo(sandbox, 'shop-api');
  linkProject(sandbox, 'shop-api', repo);

  const result = linkProject(sandbox, 'shop-api-2', repo);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /đã được link vào dự án 'shop-api'/);
});

test('rejects a path with characters that would break the bash config', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);

  const result = linkProject(sandbox, 'shop-api', createCodeRepo(sandbox, 'shop$(whoami)'));

  assert.equal(result.status, 1);
  assert.match(result.stderr, /ký tự không được phép/);
  assert.ok(!exists(projectPath(sandbox, 'shop-api')));
});

test('writes nothing when settings.json is not valid JSON', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);
  writeText(settingsPath(sandbox), '{ hỏng');

  const result = linkProject(sandbox, 'shop-api', createCodeRepo(sandbox, 'shop-api'));

  assert.equal(result.status, 1);
  assert.match(result.stderr, /không phải JSON hợp lệ/);
  assert.ok(!exists(projectPath(sandbox, 'shop-api')));
});

test('refuses to link a project into a folder that is not a gf home', (t) => {
  const sandbox = createSandbox(t);
  const repo = createCodeRepo(sandbox, 'shop-api');

  const result = runCli(sandbox, ['init-project', '--directory', sandbox.root, '--name', 'shop-api', '--project', repo]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /không phải thư mục gốc gf/);
});
