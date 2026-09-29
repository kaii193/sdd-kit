import assert from 'node:assert/strict';
import { appendFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  createProject,
  installInto,
  kitSource,
  projectFileExists,
  readManifest,
  readProjectFile,
  runCli,
  sha256,
} from './helpers.js';

function update(project) {
  return runCli(['update', '--directory', project]);
}

test('leaves a user-owned file untouched', (t) => {
  const project = createProject(t);
  installInto(project);
  writeFileSync(path.join(project, 'sdd/constitution.md'), '# Constitution của dự án\n');

  const result = update(project);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readProjectFile(project, 'sdd/constitution.md'), '# Constitution của dự án\n');
  assert.ok(!projectFileExists(project, 'sdd/constitution.md.gf-new'));
  assert.match(result.stdout, /file của bạn — không đụng[\s\S]*sdd\/constitution\.md/);
});

test('keeps a kit script the user edited and writes the new version beside it', (t) => {
  const project = createProject(t);
  installInto(project);
  appendFileSync(path.join(project, 'sdd/scripts/check-scope.sh'), 'echo local-change\n');

  const result = update(project);

  assert.equal(result.status, 0, result.stderr);
  assert.match(readProjectFile(project, 'sdd/scripts/check-scope.sh'), /echo local-change/);
  assert.equal(
    readProjectFile(project, 'sdd/scripts/check-scope.sh.gf-new'),
    kitSource('modules/sdd/files/sdd/scripts/check-scope.sh'),
  );
  assert.match(result.stdout, /bạn đã sửa[\s\S]*sdd\/scripts\/check-scope\.sh/);
});

test('upgrades a kit file installed by an older kit version', (t) => {
  const project = createProject(t);
  installInto(project);
  const olderContent = 'echo older-kit\n';
  writeFileSync(path.join(project, 'sdd/scripts/new-spec.sh'), olderContent);
  const manifest = readManifest(project);
  manifest.files['sdd/scripts/new-spec.sh'].hash = sha256(olderContent);
  writeFileSync(path.join(project, '.gf/manifest.json'), JSON.stringify(manifest));

  const result = update(project);

  assert.equal(result.status, 0, result.stderr);
  const upgraded = kitSource('modules/sdd/files/sdd/scripts/new-spec.sh');
  assert.equal(readProjectFile(project, 'sdd/scripts/new-spec.sh'), upgraded);
  assert.equal(readManifest(project).files['sdd/scripts/new-spec.sh'].hash, sha256(upgraded));
  assert.ok(!projectFileExists(project, 'sdd/scripts/new-spec.sh.gf-new'));
});

test('restores a deleted kit file', (t) => {
  const project = createProject(t);
  installInto(project);
  rmSync(path.join(project, 'sdd/scripts/lib.sh'));

  const result = update(project);

  assert.equal(result.status, 0, result.stderr);
  assert.ok(projectFileExists(project, 'sdd/scripts/lib.sh'));
});

test('refuses to update a project where the kit is not installed', (t) => {
  const project = createProject(t);

  const result = update(project);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Dùng lệnh install/);
});
