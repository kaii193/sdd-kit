import assert from 'node:assert/strict';
import { appendFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  createCodeRepo,
  createSandbox,
  exists,
  install,
  kitSource,
  linkProject,
  projectPath,
  readJson,
  readText,
  runCli,
  sha256,
  toPosix,
  writeText,
} from './helpers.js';

function update(sandbox) {
  return runCli(sandbox, ['update', '--directory', sandbox.home]);
}

function simulateOlderVersion(manifestPath, root, target) {
  const olderContent = 'bản cũ\n';
  writeText(path.join(root, target), olderContent);
  const manifest = readJson(manifestPath);
  manifest.files[target].hash = sha256(olderContent);
  writeText(manifestPath, JSON.stringify(manifest));
}

test('never touches the files of a linked project', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);
  linkProject(sandbox, 'shop-api', createCodeRepo(sandbox, 'shop-api'));
  writeText(projectPath(sandbox, 'shop-api', 'constitution.md'), '# Constitution của dự án\n');

  const result = update(sandbox);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readText(projectPath(sandbox, 'shop-api', 'constitution.md')), '# Constitution của dự án\n');
  assert.ok(!exists(projectPath(sandbox, 'shop-api', 'constitution.md.gf-new')));
});

test('leaves a user-owned home file untouched without writing a new version beside it', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);
  writeText(path.join(sandbox.home, 'CLAUDE.md'), '@AGENTS.md\nLuật riêng của tôi\n');

  const result = update(sandbox);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readText(path.join(sandbox.home, 'CLAUDE.md')), '@AGENTS.md\nLuật riêng của tôi\n');
  assert.ok(!exists(path.join(sandbox.home, 'CLAUDE.md.gf-new')));
  assert.match(result.stdout, /file của bạn — không đụng[\s\S]*CLAUDE\.md/);
});

test('keeps a kit script the user edited and writes the new version beside it', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);
  const scriptPath = path.join(sandbox.home, '.gf/scripts/check-scope.sh');
  appendFileSync(scriptPath, 'echo local-change\n');

  const result = update(sandbox);

  assert.equal(result.status, 0, result.stderr);
  assert.match(readText(scriptPath), /echo local-change/);
  assert.equal(readText(`${scriptPath}.gf-new`), kitSource('modules/sdd/home/.gf/scripts/check-scope.sh'));
});

test('upgrades a home file installed by an older kit version', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);
  const manifestPath = path.join(sandbox.home, '.gf/manifest.json');
  simulateOlderVersion(manifestPath, sandbox.home, '.gf/scripts/new-spec.sh');

  const result = update(sandbox);

  assert.equal(result.status, 0, result.stderr);
  const upgraded = kitSource('modules/sdd/home/.gf/scripts/new-spec.sh');
  assert.equal(readText(path.join(sandbox.home, '.gf/scripts/new-spec.sh')), upgraded);
  assert.equal(readJson(manifestPath).files['.gf/scripts/new-spec.sh'].hash, sha256(upgraded));
});

test('upgrades a skill installed by an older kit version and keeps the CLI path rendered', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);
  simulateOlderVersion(path.join(sandbox.claude, 'gf/manifest.json'), sandbox.claude, 'skills/gf-init/SKILL.md');

  const result = update(sandbox);

  assert.equal(result.status, 0, result.stderr);
  const expected = kitSource('modules/gf/claude/skills/gf-init/SKILL.md').replaceAll(
    '{{GF_KIT_BIN}}',
    toPosix(path.join(sandbox.claude, 'gf/kit/bin/gf.js')),
  );
  assert.equal(readText(path.join(sandbox.claude, 'skills/gf-init/SKILL.md')).replace(/\r\n/g, '\n'), expected);
});

test('restores a deleted kit script and a deleted skill', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);
  rmSync(path.join(sandbox.home, '.gf/scripts/lib.sh'));
  rmSync(path.join(sandbox.claude, 'skills/gf-spec/SKILL.md'));

  const result = update(sandbox);

  assert.equal(result.status, 0, result.stderr);
  assert.ok(exists(path.join(sandbox.home, '.gf/scripts/lib.sh')));
  assert.ok(exists(path.join(sandbox.claude, 'skills/gf-spec/SKILL.md')));
});

test('refuses to update a folder that is not a gf home', (t) => {
  const sandbox = createSandbox(t);
  createCodeRepo(sandbox, 'x');

  const result = runCli(sandbox, ['update', '--directory', sandbox.root]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Dùng lệnh install/);
});
