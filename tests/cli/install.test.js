import assert from 'node:assert/strict';
import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  createProject,
  installInto,
  projectFileExists,
  readManifest,
  readProjectFile,
  runCli,
} from './helpers.js';

test('installs sdd and gf, pulling sdd in as a dependency, and records a manifest', (t) => {
  const project = createProject(t);

  const result = installInto(project);

  assert.equal(result.status, 0, result.stderr);
  for (const file of ['AGENTS.md', 'CLAUDE.md', 'sdd/scripts/check-ready.sh', '.github/workflows/sdd-check.yml']) {
    assert.ok(projectFileExists(project, file), `thiếu ${file}`);
  }
  const manifest = readManifest(project);
  assert.deepEqual(manifest.modules, ['sdd', 'gf']);
  assert.equal(manifest.files['AGENTS.md'].owner, 'user');
  assert.equal(manifest.files['sdd/scripts/lib.sh'].owner, 'kit');
});

test('writes every shell script with LF line endings', (t) => {
  const project = createProject(t);

  installInto(project);

  const scripts = readdirSync(path.join(project, 'sdd/scripts')).filter((name) => name.endsWith('.sh'));
  assert.ok(scripts.length > 0);
  for (const script of scripts) {
    assert.ok(!readProjectFile(project, `sdd/scripts/${script}`).includes('\r'), `${script} còn CRLF`);
  }
});

test('installs without bash on PATH', (t) => {
  const project = createProject(t);

  const result = runCli(
    ['install', '--directory', project, '--modules', 'gf', '--tools', 'claude-code', '--yes'],
    { onlyNodeOnPath: true },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.ok(projectFileExists(project, '.gf/manifest.json'));
});

test('rejects --yes without --tools and names the missing option', (t) => {
  const project = createProject(t);

  const result = runCli(['install', '--directory', project, '--modules', 'gf', '--yes']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Thiếu --tools/);
  assert.ok(!projectFileExists(project, '.gf/manifest.json'));
});

test('prompts for missing values and installs after confirmation', (t) => {
  const project = createProject(t);

  const result = runCli(['install'], { input: `${project}\ngf\nclaude-code\ny\n` });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Thư mục dự án:/);
  assert.match(result.stdout, /Tiếp tục cài\?/);
  assert.ok(projectFileExists(project, '.gf/manifest.json'));
});

test('writes nothing when the confirmation is declined', (t) => {
  const project = createProject(t);

  const result = runCli(['install', '--directory', project, '--modules', 'gf', '--tools', 'claude-code'], {
    input: 'n\n',
  });

  assert.equal(result.status, 1);
  assert.ok(!projectFileExists(project, 'AGENTS.md'));
  assert.ok(!projectFileExists(project, '.gf/manifest.json'));
});

test('rejects an unknown tool', (t) => {
  const project = createProject(t);

  const result = installInto(project, { tools: 'claude-code,vim' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Tool không hỗ trợ: vim/);
});

test('rejects gf without claude-code', (t) => {
  const project = createProject(t);

  const result = installInto(project, { tools: 'cursor' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Module 'gf' cần tool: claude-code/);
});

test('rejects an unknown module', (t) => {
  const project = createProject(t);

  const result = installInto(project, { modules: 'bmm' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Module không tồn tại: bmm/);
});

test('installs the cursor and copilot rule files for the sdd module', (t) => {
  const project = createProject(t);

  const result = installInto(project, { modules: 'sdd', tools: 'cursor,github-copilot' });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(projectFileExists(project, '.cursor/rules/sdd.mdc'));
  assert.ok(projectFileExists(project, '.github/copilot-instructions.md'));
  assert.ok(!projectFileExists(project, 'CLAUDE.md'));
});

test('keeps files that already exist in the project', (t) => {
  const project = createProject(t);
  writeFileSync(path.join(project, 'CLAUDE.md'), 'của tôi\n');

  const result = installInto(project);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readProjectFile(project, 'CLAUDE.md'), 'của tôi\n');
  assert.match(result.stdout, /= CLAUDE\.md \(đã tồn tại, bỏ qua\)/);
  assert.equal(readManifest(project).files['CLAUDE.md'], undefined);
});

test('skips the CI workflow with --no-ci', (t) => {
  const project = createProject(t);

  installInto(project, { extra: ['--no-ci'] });

  assert.ok(!projectFileExists(project, '.github/workflows/sdd-check.yml'));
  assert.ok(projectFileExists(project, '.github/pull_request_template.md'));
});

test('refuses to install twice and points to update', (t) => {
  const project = createProject(t);
  installInto(project);

  const result = installInto(project);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Dùng lệnh update/);
});
