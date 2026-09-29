import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { validateTools } from '../../lib/installer.js';
import { createSandbox, exists, install, readJson, readText, runCli, toPosix, writeText } from './helpers.js';

test('installs skills and a kit copy into the Claude dir and scaffolds the gf home', (t) => {
  const sandbox = createSandbox(t);

  const result = install(sandbox);

  assert.equal(result.status, 0, result.stderr);
  for (const file of ['skills/gf-init/SKILL.md', 'skills/gf-spec/SKILL.md', 'skills/gf-implement/SKILL.md', 'agents/gf-pm.md', 'agents/gf-coder.md', 'agents/gf-qc.md', 'agents/gf-reviewer.md', 'agents/gf-spec-researcher.md', 'agents/gf-spec-critic-user.md', 'agents/gf-spec-critic-attacker.md', 'agents/gf-spec-critic-maintainer.md', 'agents/gf-spec-moderator.md', 'gf/kit/bin/gf.js', 'gf/manifest.json']) {
    assert.ok(exists(path.join(sandbox.claude, file)), `thiếu ~/.claude/${file}`);
  }
  for (const file of ['AGENTS.md', 'CLAUDE.md', '.gf/scripts/check-ready.sh', '.gf/templates/spec/spec.md', 'projects', '.claude/settings.json']) {
    assert.ok(exists(path.join(sandbox.home, file)), `thiếu ${file} trong thư mục gốc`);
  }
  assert.deepEqual(readJson(path.join(sandbox.home, '.gf/manifest.json')).modules, ['sdd', 'gf']);
  assert.deepEqual(readJson(path.join(sandbox.claude, 'gf/manifest.json')).homes, [toPosix(sandbox.home)]);
});

test('renders the absolute path of the installed CLI into the skills', (t) => {
  const sandbox = createSandbox(t);

  install(sandbox);

  const skill = readText(path.join(sandbox.claude, 'skills/gf-init/SKILL.md'));
  assert.ok(!skill.includes('{{'), 'còn placeholder chưa thay');
  assert.ok(skill.includes(toPosix(path.join(sandbox.claude, 'gf/kit/bin/gf.js'))));
});

test('installs a kit copy that runs on its own', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);

  const result = spawnSync(process.execPath, [path.join(sandbox.claude, 'gf/kit/bin/gf.js'), '--help'], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /init-project/);
});

test('writes every shell script with LF line endings', (t) => {
  const sandbox = createSandbox(t);

  install(sandbox);

  const scriptsDir = path.join(sandbox.home, '.gf/scripts');
  const scripts = readdirSync(scriptsDir).filter((name) => name.endsWith('.sh'));
  assert.ok(scripts.length > 0);
  for (const script of scripts) {
    assert.ok(!readText(path.join(scriptsDir, script)).includes('\r'), `${script} còn CRLF`);
  }
});

test('installs without bash on PATH', (t) => {
  const sandbox = createSandbox(t);

  const result = runCli(
    sandbox,
    ['install', '--directory', sandbox.home, '--modules', 'gf', '--tools', 'claude-code', '--yes'],
    { onlyNodeOnPath: true },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.ok(exists(path.join(sandbox.home, '.gf/manifest.json')));
});

test('rejects --yes without --tools and names the missing option', (t) => {
  const sandbox = createSandbox(t);

  const result = runCli(sandbox, ['install', '--directory', sandbox.home, '--modules', 'gf', '--yes']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Thiếu --tools/);
  assert.ok(!exists(path.join(sandbox.home, '.gf/manifest.json')));
});

test('prompts for missing values and installs after confirmation', (t) => {
  const sandbox = createSandbox(t);

  const result = runCli(sandbox, ['install'], { input: `${sandbox.home}\ngf\nclaude-code\ny\n` });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Thư mục gốc gf/);
  assert.match(result.stdout, /Tiếp tục cài\?/);
  assert.ok(exists(path.join(sandbox.home, '.gf/manifest.json')));
});

test('writes nothing when the confirmation is declined', (t) => {
  const sandbox = createSandbox(t);

  const result = runCli(sandbox, ['install', '--directory', sandbox.home, '--modules', 'gf', '--tools', 'claude-code'], {
    input: 'n\n',
  });

  assert.equal(result.status, 1);
  assert.ok(!exists(sandbox.home));
  assert.ok(!exists(sandbox.claude));
});

test('rejects tools that are no longer supported', (t) => {
  const sandbox = createSandbox(t);

  const result = install(sandbox, { tools: 'claude-code,cursor' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Tool không hỗ trợ: cursor/);
});

test('rejects an unknown module', (t) => {
  const sandbox = createSandbox(t);

  const result = install(sandbox, { modules: 'bmm' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Module không tồn tại: bmm/);
});

test('requires every tool a module declares', () => {
  const catalog = {
    tools: ['claude-code', 'other'],
    modules: new Map([['gf', { requiresTools: ['claude-code'] }]]),
  };

  assert.throws(() => validateTools(catalog, ['gf'], ['other']), /Module 'gf' cần tool: claude-code/);
});

test('keeps files that already exist in the gf home and does not track them', (t) => {
  const sandbox = createSandbox(t);
  mkdirSync(sandbox.home, { recursive: true });
  writeText(path.join(sandbox.home, 'CLAUDE.md'), 'của tôi\n');

  const result = install(sandbox);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readText(path.join(sandbox.home, 'CLAUDE.md')), 'của tôi\n');
  assert.match(result.stdout, /= CLAUDE\.md \(đã tồn tại, bỏ qua\)/);
  assert.equal(readJson(path.join(sandbox.home, '.gf/manifest.json')).files['CLAUDE.md'], undefined);
});

test('refuses to install twice into the same gf home', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);

  const result = install(sandbox);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Dùng lệnh update/);
});

test('shares one Claude dir between two gf homes without overwriting an edited skill', (t) => {
  const sandbox = createSandbox(t);
  install(sandbox);
  const skillPath = path.join(sandbox.claude, 'skills/gf-spec/SKILL.md');
  appendFileSync(skillPath, '\nGhi chú của tôi\n');
  const secondHome = path.join(sandbox.root, 'gf-work-2');

  const result = install(sandbox, { home: secondHome });

  assert.equal(result.status, 0, result.stderr);
  assert.match(readText(skillPath), /Ghi chú của tôi/);
  assert.ok(exists(`${skillPath}.gf-new`));
  assert.deepEqual(readJson(path.join(sandbox.claude, 'gf/manifest.json')).homes, [
    toPosix(sandbox.home),
    toPosix(secondHome),
  ]);
});
