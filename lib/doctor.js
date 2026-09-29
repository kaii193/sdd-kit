import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { CliError } from './errors.js';
import { readJsonIfExists } from './files.js';
import { isGitRepository } from './git.js';
import { CLAUDE_MANIFEST, HOME_MANIFEST, KIT_BIN, KIT_COPY_DIR, SETTINGS_PATH } from './installer.js';
import { listProjects, readProjectFile, readSettings, samePath } from './projects.js';

const MIN_NODE_MAJOR = 18;
const MIN_BASH_MAJOR = 4;
const REQUIRED_SKILLS = ['gf-init', 'gf-spec'];
const REQUIRED_COMMANDS = ['TEST_COMMAND', 'LINT_COMMAND'];
const DEFAULT_DECISIONS_HEADING = '### 4.5';
const TELEGRAM_VARIABLES = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
const READ_CONFIG_SCRIPT = [
  'source ./config.sh',
  'printf "PROJECT_PATH=%s\\n" "$PROJECT_PATH"',
  ...REQUIRED_COMMANDS.map((name) => `printf "${name}=%s\\n" "$${name}"`),
  'for glob in "${MODULE_GLOBS[@]}"; do printf "MODULE_GLOB=%s\\n" "$glob"; done',
].join('; ');

export const MANUAL_CHECKLIST = [
  'Claude Desktop ≥ 1.1.5368 và đang mở',
  'Tác vụ runner: Routines → Local, trỏ vào thư mục gốc gf, mỗi 1 giờ, chế độ auto, KHÔNG tích worktree',
];

export async function runDoctor({ homeDir, claudeDir, autonomous, env }) {
  const baseChecks = [
    checkNodeVersion(),
    checkBashVersion(),
    await checkHomeManifest(homeDir),
    await checkClaudeInstall(claudeDir),
    ...(await checkProjects(homeDir)),
  ];
  const autonomousChecks = [...TELEGRAM_VARIABLES.map((name) => checkVariable(env, name)), checkGithubCli()]
    .map((check) => ({ ...check, required: autonomous, autonomousOnly: true }));
  return [...baseChecks.map((check) => ({ required: true, ...check })), ...autonomousChecks];
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
    label: `bash ≥ ${MIN_BASH_MAJOR}${major > 0 ? ` (hiện: ${major})` : ''}`,
    ok: result.status === 0 && major >= MIN_BASH_MAJOR,
    hint: 'Cài bash ≥ 4 (Windows: Git Bash; macOS: brew install bash)',
  };
}

async function checkHomeManifest(homeDir) {
  return {
    label: `Thư mục gốc gf (${HOME_MANIFEST})`,
    ok: (await readJsonIfExists(path.join(homeDir, HOME_MANIFEST))) !== null,
    hint: 'Chạy install --directory <thư mục gốc> trước',
  };
}

async function checkClaudeInstall(claudeDir) {
  const manifest = await readJsonIfExists(path.join(claudeDir, CLAUDE_MANIFEST));
  const missing = [
    ...REQUIRED_SKILLS.filter((skill) => !existsSync(path.join(claudeDir, 'skills', skill, 'SKILL.md'))).map(
      (skill) => `skill ${skill}`,
    ),
    ...(existsSync(path.join(claudeDir, KIT_COPY_DIR, KIT_BIN)) ? [] : ['bản CLI']),
  ];
  return {
    label: `Skill và CLI trong ${claudeDir}`,
    ok: manifest !== null && missing.length === 0,
    hint: manifest ? `Thiếu: ${missing.join(', ')} — chạy update` : 'Chưa cài — chạy install',
  };
}

async function checkProjects(homeDir) {
  const projects = await listProjects(homeDir);
  if (!projects.length) {
    return [{ label: 'Dự án đã link', ok: false, required: false, hint: 'Chưa có — mở Claude trong thư mục gốc, gõ /gf-init' }];
  }
  const settings = await loadAllowedDirectories(homeDir);
  const nested = await Promise.all(projects.map((project) => checkProject(project, settings.directories)));
  return [settings.check, ...nested.flat()];
}

async function loadAllowedDirectories(homeDir) {
  const label = `${SETTINGS_PATH} là JSON hợp lệ`;
  try {
    const settings = await readSettings(path.join(homeDir, SETTINGS_PATH));
    return { check: { label, ok: true }, directories: settings.permissions?.additionalDirectories ?? [] };
  } catch (error) {
    if (!(error instanceof CliError)) throw error;
    return { check: { label, ok: false, hint: error.message }, directories: [] };
  }
}

async function checkProject(project, allowedDirectories) {
  const prefix = `[${project.name}]`;
  const config = readProjectConfig(project.dir);
  if (!config) return [{ label: `${prefix} config.sh đọc được`, ok: false, hint: `Kiểm tra ${project.dir}/config.sh` }];
  const linkedPath = config.PROJECT_PATH;
  const linkedExists = Boolean(linkedPath) && existsSync(linkedPath);
  const missingCommands = REQUIRED_COMMANDS.filter((name) => !config[name]);
  const missingGlobs = linkedExists
    ? config.MODULE_GLOB.map((glob) => glob.replace(/\*+$/, '').replace(/\/$/, '')).filter(
        (prefixDir) => !existsSync(path.join(linkedPath, prefixDir)),
      )
    : [];
  const decisionsFilled = hasFilledBullet(await readProjectFile(project, 'constitution.md'), DEFAULT_DECISIONS_HEADING);
  return [
    {
      label: `${prefix} Repo code tồn tại và là git repo (${linkedPath || 'chưa khai'})`,
      ok: linkedExists && isGitRepository(linkedPath),
      hint: 'Sửa PROJECT_PATH trong config.sh',
    },
    {
      label: `${prefix} Lệnh ${REQUIRED_COMMANDS.join(', ')} đã điền`,
      ok: missingCommands.length === 0,
      hint: `Còn trống: ${missingCommands.join(', ')} — gate chạy các lệnh này`,
    },
    {
      label: `${prefix} MODULE_GLOBS khớp thư mục trong repo code`,
      ok: linkedExists && missingGlobs.length === 0,
      hint: `Không có thư mục: ${missingGlobs.join(', ') || '(repo code không tồn tại)'}`,
    },
    {
      label: `${prefix} constitution.md mục 4.5 "Quyết định mặc định cho agent" đã điền`,
      ok: decisionsFilled,
      hint: 'Điền ít nhất một quyết định thật (không còn <vd: ...>) — agent dựa vào đây khi spec không nói tới',
    },
    {
      label: `${prefix} Repo code có trong additionalDirectories của .claude/settings.json`,
      ok: allowedDirectories.some((directory) => samePath(directory, linkedPath)),
      hint: 'Thêm đường dẫn repo code vào permissions.additionalDirectories',
    },
  ];
}

function readProjectConfig(projectDir) {
  const result = spawnSync('bash', ['-c', READ_CONFIG_SCRIPT], { cwd: projectDir, encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).filter(Boolean).reduce(
    (config, line) => {
      const separator = line.indexOf('=');
      const key = line.slice(0, separator);
      const value = line.slice(separator + 1);
      if (key === 'MODULE_GLOB') return { ...config, MODULE_GLOB: [...config.MODULE_GLOB, value] };
      return { ...config, [key]: value };
    },
    { MODULE_GLOB: [] },
  );
}

function hasFilledBullet(markdown, headingPrefix) {
  if (!markdown) return false;
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(headingPrefix));
  if (start === -1) return false;
  const end = lines.findIndex((line, index) => index > start && line.startsWith('#'));
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .some((line) => line.startsWith('- ') && !line.includes('<'));
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
  return { label: 'GitHub CLI đã đăng nhập (để mở PR)', ok: result.status === 0, hint: 'Chạy `gh auth login`' };
}
