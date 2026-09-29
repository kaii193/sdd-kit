import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { CliError } from '../errors.js';
import { isGitRepository, runGit } from '../git.js';

export async function ensureWorktree(context) {
  const { worktreePath, branch, config } = context;
  if (existsSync(worktreePath) && isGitRepository(worktreePath)) return { created: false };
  const repo = config.PROJECT_PATH;
  if (!isGitRepository(repo)) throw new CliError(`Repo code không phải git repo: ${repo}`);
  runGit(repo, ['worktree', 'prune']);
  await mkdir(path.dirname(worktreePath), { recursive: true });
  const branchExists = runGit(repo, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]) !== null;
  const args = branchExists
    ? ['worktree', 'add', worktreePath, branch]
    : ['worktree', 'add', '-b', branch, worktreePath, config.BASE_BRANCH];
  if (runGit(repo, args) === null) {
    throw new CliError(`Không tạo được git worktree ${worktreePath} cho ${branch} (branch có thể đang được checkout ở worktree khác)`);
  }
  return { created: true };
}

export function taskBranchName(context, taskId) {
  return `${context.branch}-${taskId.toLowerCase()}`;
}

export function switchToTaskBranch(context, taskId) {
  const branch = taskBranchName(context, taskId);
  const baseBranch = runGit(context.worktreePath, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const exists = runGit(context.worktreePath, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]) !== null;
  const switched = runGit(context.worktreePath, exists ? ['switch', branch] : ['switch', '-c', branch]);
  if (switched === null) throw new CliError(`Không chuyển được sang branch ${branch} trong ${context.worktreePath}`);
  return { branch, baseBranch: baseBranch === context.branch ? context.config.BASE_BRANCH : baseBranch };
}

export function headCommit(worktreePath) {
  return runGit(worktreePath, ['rev-parse', 'HEAD']);
}
