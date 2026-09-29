import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = path.join(KIT_ROOT, 'bin', 'gf.js');

export function createSandbox(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'gf-cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, home: path.join(root, 'gf-work'), claude: path.join(root, 'claude') };
}

export function runCli(sandbox, args, { input = '', env = {}, onlyNodeOnPath = false } = {}) {
  const baseEnv = onlyNodeOnPath ? envWithOnlyNodeOnPath() : process.env;
  const result = spawnSync(process.execPath, [CLI, ...args], {
    input,
    encoding: 'utf8',
    env: { ...baseEnv, CLAUDE_CONFIG_DIR: sandbox.claude, ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function envWithOnlyNodeOnPath() {
  const withoutPath = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path'));
  return { ...withoutPath, PATH: path.dirname(process.execPath) };
}

export function install(sandbox, { home = sandbox.home, modules = 'gf', tools = 'claude-code' } = {}) {
  return runCli(sandbox, ['install', '--directory', home, '--modules', modules, '--tools', tools, '--yes']);
}

export function createCodeRepo(sandbox, name, { git = true, folders = ['src/cart'] } = {}) {
  const repo = path.join(sandbox.root, 'code', name);
  for (const folder of folders) mkdirSync(path.join(repo, folder), { recursive: true });
  mkdirSync(repo, { recursive: true });
  if (git) spawnSync('git', ['init', '-q', repo]);
  return repo;
}

export function linkProject(sandbox, name, repo) {
  return runCli(sandbox, ['init-project', '--directory', sandbox.home, '--name', name, '--project', repo]);
}

export function projectPath(sandbox, name, file = '') {
  return path.join(sandbox.home, 'projects', name, file);
}

export function readText(filePath) {
  return readFileSync(filePath, 'utf8');
}

export function writeText(filePath, content) {
  writeFileSync(filePath, content);
}

export function exists(filePath) {
  return existsSync(filePath);
}

export function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

export function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

export function kitSource(relativePath) {
  return readText(path.join(KIT_ROOT, relativePath)).replace(/\r\n/g, '\n');
}

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}
