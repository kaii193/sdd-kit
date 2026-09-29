import { spawnSync } from 'node:child_process';

export function runGit(directory, args) {
  const result = spawnSync('git', ['-C', directory, ...args], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

export function isGitRepository(directory) {
  return runGit(directory, ['rev-parse', '--is-inside-work-tree']) === 'true';
}
