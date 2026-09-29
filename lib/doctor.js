import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readManifest, MANIFEST_PATH } from './installer.js';

const MIN_NODE_MAJOR = 18;
const MIN_BASH_MAJOR = 4;
const PROJECT_COMMANDS_HEADING = '## 7.';
const UNFILLED_COMMAND = '`...`';
const TELEGRAM_VARIABLES = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];

export const MANUAL_CHECKLIST = [
  'Claude Desktop ≥ 1.1.5368 và đang mở',
  'Tác vụ gf-runner: Routines → Local, trỏ đúng folder dự án, chế độ auto, đã tích worktree',
];

export async function runDoctor(directory, { autonomous, env }) {
  const baseChecks = [
    checkGitRepository(directory),
    checkNodeVersion(),
    checkBashVersion(),
    await checkManifest(directory),
    await checkProjectCommands(directory),
    checkModuleGlobs(directory),
  ].map((check) => ({ ...check, required: true }));
  const autonomousChecks = [...TELEGRAM_VARIABLES.map((name) => checkVariable(env, name)), checkGithubCli()]
    .map((check) => ({ ...check, required: autonomous, autonomousOnly: true }));
  return [...baseChecks, ...autonomousChecks];
}

function checkGitRepository(directory) {
  const result = spawnSync('git', ['-C', directory, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' });
  return {
    label: 'Git repository',
    ok: result.status === 0,
    hint: 'Chạy `git init` trong thư mục dự án',
  };
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split('.')[0]);
  return {
    label: `Node ≥ ${MIN_NODE_MAJOR} (hiện: ${process.versions.node})`,
    ok: major >= MIN_NODE_MAJOR,
    hint: `Cài Node ${MIN_NODE_MAJOR} trở lên`,
  };
}

function checkBashVersion() {
  const result = spawnSync('bash', ['-c', 'echo "${BASH_VERSINFO[0]}"'], { encoding: 'utf8' });
  const major = Number(result.stdout?.trim());
  return {
    label: `bash ≥ ${MIN_BASH_MAJOR}${Number.isFinite(major) && major > 0 ? ` (hiện: ${major})` : ''}`,
    ok: result.status === 0 && major >= MIN_BASH_MAJOR,
    hint: 'Cài bash ≥ 4 (Windows: Git Bash; macOS: brew install bash)',
  };
}

async function checkManifest(directory) {
  return {
    label: `Đã cài kit (${MANIFEST_PATH})`,
    ok: (await readManifest(directory)) !== null,
    hint: 'Chạy lệnh install trước',
  };
}

async function checkProjectCommands(directory) {
  const agentsPath = path.join(directory, 'AGENTS.md');
  const label = 'AGENTS.md mục 7 (lệnh dự án) đã điền';
  if (!existsSync(agentsPath)) return { label, ok: false, hint: 'Thiếu AGENTS.md' };
  const section = extractSection(await readFile(agentsPath, 'utf8'), PROJECT_COMMANDS_HEADING);
  return {
    label,
    ok: section !== '' && !section.includes(UNFILLED_COMMAND),
    hint: `Thay các lệnh ${UNFILLED_COMMAND} bằng lệnh thật (test, lint, e2e) — gate chạy các lệnh này`,
  };
}

function extractSection(markdown, headingPrefix) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(headingPrefix));
  if (start === -1) return '';
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

function checkModuleGlobs(directory) {
  const label = 'MODULE_GLOBS trong sdd/config.sh khớp thư mục có thật';
  const result = spawnSync('bash', ['-c', 'source sdd/config.sh && printf "%s\\n" "${MODULE_GLOBS[@]}"'], {
    cwd: directory,
    encoding: 'utf8',
  });
  if (result.status !== 0) return { label, ok: false, hint: 'Không đọc được sdd/config.sh' };
  const missing = result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((glob) => glob.replace(/\*+$/, '').replace(/\/$/, ''))
    .filter((prefix) => !existsSync(path.join(directory, prefix)));
  return {
    label,
    ok: missing.length === 0,
    hint: `Không có thư mục: ${missing.join(', ')} — sửa MODULE_GLOBS cho khớp cấu trúc dự án`,
  };
}

function checkVariable(env, name) {
  return {
    label: `Biến môi trường ${name}`,
    ok: Boolean(env[name]),
    hint: `Đặt ${name} để runner gửi báo cáo Telegram`,
  };
}

function checkGithubCli() {
  const result = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' });
  return {
    label: 'GitHub CLI đã đăng nhập (để mở PR)',
    ok: result.status === 0,
    hint: 'Chạy `gh auth login`',
  };
}
