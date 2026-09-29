import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { runGit } from '../git.js';
import { Result } from './state-machine.js';
import { headCommit } from './worktree.js';

const MISSING_COMMAND_EXIT = 127;
const INHERITED_TEST_RUNNER_VARIABLES = ['NODE_TEST_CONTEXT'];
const NOT_REACHING_ASSERTION = /Cannot find module|ERR_MODULE_NOT_FOUND|ModuleNotFoundError|ImportError|SyntaxError|cannot find symbol|undefined: |error TS\d+|Compilation failed|does not provide an export named/;
const TEST_DECLARATION = /\b(?:it|test)\s*\(|\bdef test_\w+|@Test\b|\bfunc Test\w+\s*\(|#\[test\]/g;
const ASSERTION = /\b(?:expect|assert\w*)\s*[.(]|(?<!import\s)\bassert\s+(?!from\b)\w|\bt\.(?:Error|Fatal)f?\s*\(|\bshould\./g;
const SPEC_REFERENCE = /\b(?:AC|FR)-\d+\b/;
const OUTPUT_TAIL_LINES = 40;
const MILLISECONDS_PER_SECOND = 1000;

export function runProjectCommand(command, cwd, timeoutSeconds) {
  const result = spawnSync('bash', ['-c', command], {
    cwd,
    env: withoutInheritedTestRunner(process.env),
    encoding: 'utf8',
    timeout: timeoutSeconds * MILLISECONDS_PER_SECOND,
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const timedOut = result.error?.code === 'ETIMEDOUT';
  const missing = !command || result.status === MISSING_COMMAND_EXIT;
  return { status: result.status, output: tail(output), timedOut, missing };
}

export function countTestsAndAssertions(worktreePath, files) {
  return files
    .map((file) => path.join(worktreePath, file))
    .filter((filePath) => existsSync(filePath))
    .map((filePath) => readFileSync(filePath, 'utf8'))
    .reduce(
      (counts, content) => ({
        tests: counts.tests + (content.match(TEST_DECLARATION)?.length ?? 0),
        assertions: counts.assertions + (content.match(ASSERTION)?.length ?? 0),
      }),
      { tests: 0, assertions: 0 },
    );
}

export function lockTests(context, task) {
  const worktree = context.worktreePath;
  const files = changedFiles(worktree, `${task.stubCommit}..HEAD`);
  if (!files.length) return { result: Result.Fail, note: 'QC chưa commit file test nào sau stub' };
  const lock = { commit: headCommit(worktree), files, ...countTestsAndAssertions(worktree, files) };
  if (lock.tests === 0) return { result: Result.Fail, note: 'Không nhận ra test nào trong file QC đã commit', lock };
  const run = runProjectCommand(context.config.TEST_COMMAND, worktree, context.config.COMMAND_TIMEOUT_SECONDS);
  if (run.missing) return { result: Result.Blocked, note: `TEST_COMMAND không chạy được: ${run.output}`, lock };
  if (run.status === 0) return { result: Result.Fail, note: 'Test PASS ngay trên code chưa implement — test không kiểm gì', lock };
  if (NOT_REACHING_ASSERTION.test(run.output)) {
    return { result: Result.Fail, note: `Test đỏ do lỗi biên dịch/import, chưa tới assertion:\n${run.output}`, lock };
  }
  return { result: Result.Pass, note: 'Test đỏ tại assertion', lock };
}

export function relockTests(context, task, reason) {
  if (!SPEC_REFERENCE.test(reason ?? '')) {
    return { result: Result.Fail, note: 'Sửa test phải trích ID trong spec (AC-x hoặc FR-x)' };
  }
  const worktree = context.worktreePath;
  const edited = changedFiles(worktree, `${task.lock.commit}..HEAD`, task.lock.files);
  const files = [...new Set([...task.lock.files, ...changedFiles(worktree, `${task.lock.commit}..HEAD`).filter(isTestFile)])];
  const counts = countTestsAndAssertions(worktree, files);
  if (counts.tests < task.lock.tests || counts.assertions < task.lock.assertions) {
    return {
      result: Result.Fail,
      note: `Số test/assertion giảm (${task.lock.tests}/${task.lock.assertions} → ${counts.tests}/${counts.assertions})`,
    };
  }
  return { result: Result.Pass, note: `QC sửa ${edited.length} file test: ${reason}`, lock: { commit: headCommit(worktree), files, ...counts } };
}

export function runGate(context, task) {
  const worktree = context.worktreePath;
  const { config } = context;
  const lockedChanges = changedFiles(worktree, `${task.lock.commit}..HEAD`, task.lock.files);
  if (lockedChanges.length) return fail(`Test đã khóa bị sửa: ${lockedChanges.join(', ')}`);
  const counts = countTestsAndAssertions(worktree, task.lock.files);
  if (counts.tests < task.lock.tests || counts.assertions < task.lock.assertions) {
    return fail(`Số test/assertion giảm so với lúc khóa (${task.lock.tests}/${task.lock.assertions} → ${counts.tests}/${counts.assertions})`);
  }
  const forbidden = changedFiles(worktree, `${config.BASE_BRANCH}...HEAD`).filter((file) =>
    config.FORBIDDEN_PATHS.some((prefix) => file.startsWith(prefix)),
  );
  if (forbidden.length) return fail(`Sửa đường dẫn bị cấm (${config.FORBIDDEN_PATHS.join(', ')}): ${forbidden.join(', ')}`);
  const scope = runScopeCheck(context);
  if (scope.status !== 0) return fail(`check-scope không đạt:\n${scope.output}`);
  for (const [name, command] of [['LINT_COMMAND', config.LINT_COMMAND], ['TEST_COMMAND', config.TEST_COMMAND]]) {
    const run = runProjectCommand(command, worktree, config.COMMAND_TIMEOUT_SECONDS);
    if (run.missing) return { result: Result.Blocked, note: `${name} không chạy được: ${run.output}` };
    if (run.timedOut) return { result: Result.Blocked, note: `${name} quá thời gian ${config.COMMAND_TIMEOUT_SECONDS}s` };
    if (run.status !== 0) return fail(`${name} không đạt:\n${run.output}`);
  }
  return { result: Result.Pass, note: 'Gate đạt: khóa test nguyên vẹn, phạm vi đúng, lint và test xanh' };
}

function runScopeCheck(context) {
  const script = path.join(context.homeDir, '.gf', 'scripts', 'check-scope.sh');
  const result = spawnSync('bash', [script, context.specDir], {
    cwd: context.homeDir,
    encoding: 'utf8',
    env: { ...process.env, GF_CODE_DIR: context.worktreePath },
  });
  return { status: result.status, output: tail(`${result.stdout ?? ''}${result.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '')) };
}

function changedFiles(worktree, range, onlyFiles = null) {
  const args = ['-c', 'core.quotePath=false', 'diff', '--name-only', '--no-renames', range];
  const output = runGit(worktree, onlyFiles ? [...args, '--', ...onlyFiles] : args);
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

function isTestFile(file) {
  return /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.\w+$|_test\.\w+$|(^|\/)test_\w+\.\w+$/.test(file);
}

function withoutInheritedTestRunner(env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !INHERITED_TEST_RUNNER_VARIABLES.includes(key)));
}

function fail(note) {
  return { result: Result.Fail, note };
}

function tail(text) {
  return text.trim().split(/\r?\n/).slice(-OUTPUT_TAIL_LINES).join('\n');
}
