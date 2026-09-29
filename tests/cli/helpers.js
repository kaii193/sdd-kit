import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = path.join(KIT_ROOT, 'bin', 'gf.js');

export function runCli(args, { input = '', env = {}, onlyNodeOnPath = false } = {}) {
  const baseEnv = onlyNodeOnPath ? envWithOnlyNodeOnPath() : process.env;
  const result = spawnSync(process.execPath, [CLI, ...args], {
    input,
    encoding: 'utf8',
    env: { ...baseEnv, ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function envWithOnlyNodeOnPath() {
  const withoutPath = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path'));
  return { ...withoutPath, PATH: path.dirname(process.execPath) };
}

export function createProject(t, { git = true } = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'gf-cli-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  if (git) spawnSync('git', ['init', '-q', directory]);
  return directory;
}

export function installInto(directory, { modules = 'gf', tools = 'claude-code', extra = [] } = {}) {
  return runCli(['install', '--directory', directory, '--modules', modules, '--tools', tools, '--yes', ...extra]);
}

export function readProjectFile(directory, relativePath) {
  return readFileSync(path.join(directory, relativePath), 'utf8');
}

export function projectFileExists(directory, relativePath) {
  return existsSync(path.join(directory, relativePath));
}

export function readManifest(directory) {
  return JSON.parse(readProjectFile(directory, '.gf/manifest.json'));
}

export function kitSource(relativePath) {
  return readFileSync(path.join(KIT_ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}
