import { stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadCatalog } from './catalog.js';
import { MANUAL_CHECKLIST, runDoctor } from './doctor.js';
import { CliError } from './errors.js';
import { applyInstall, applyUpdate, planInstall } from './installer.js';
import { initProject } from './projects.js';
import { createPrompter } from './prompt.js';

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT_COMMAND = 'npx github:kaii193/sdd-kit';
const CONFIRM_ANSWERS = ['y', 'yes', 'c', 'có'];

const USAGE = `Dùng:
  ${KIT_COMMAND} install      --directory <thư-mục-gốc> --modules <m1,m2> --tools <t1,t2> [--yes]
  ${KIT_COMMAND} update       --directory <thư-mục-gốc>
  ${KIT_COMMAND} doctor       --directory <thư-mục-gốc> [--autonomous]
  ${KIT_COMMAND} init-project --directory <thư-mục-gốc> --name <tên> --project <repo-code>`;

const OPTIONS = {
  directory: { type: 'string' },
  modules: { type: 'string' },
  tools: { type: 'string' },
  name: { type: 'string' },
  project: { type: 'string' },
  yes: { type: 'boolean', short: 'y', default: false },
  autonomous: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
};

const COMMANDS = {
  install: runInstall,
  update: runUpdate,
  doctor: runDoctorCommand,
  'init-project': runInitProject,
};

const UPDATE_SECTIONS = [
  ['added', '+ thêm mới'],
  ['upgraded', '↑ nâng cấp'],
  ['keptModified', '! bạn đã sửa — giữ nguyên, bản mới ghi vào *.gf-new'],
  ['keptUser', '= file của bạn — không đụng'],
  ['keptForeign', '= có từ trước khi cài kit — không đụng'],
];

export async function run(argv, io) {
  const parsed = parseArguments(argv, io);
  if (!parsed) return 1;
  const [command] = parsed.positionals;
  if (parsed.values.help) {
    io.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const handler = COMMANDS[command];
  if (!handler) {
    io.stderr.write(`${command ? `Lệnh không hợp lệ: ${command}\n` : ''}${USAGE}\n`);
    return 1;
  }
  try {
    return await handler(parsed.values, io);
  } catch (error) {
    if (!(error instanceof CliError)) throw error;
    io.stderr.write(`Lỗi: ${error.message}\n`);
    return 1;
  }
}

function parseArguments(argv, io) {
  try {
    return parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  } catch (error) {
    io.stderr.write(`${error.message}\n${USAGE}\n`);
    return null;
  }
}

function claudeDirOf(env) {
  return env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

async function runInstall(values, io) {
  const catalog = await loadCatalog(KIT_ROOT);
  const prompter = values.yes ? null : createPrompter(io.stdin, io.stdout);
  try {
    const request = await completeInstallRequest(values, catalog, prompter, io);
    const plan = await planInstall(catalog, request);
    printPlan(plan, io);
    if (prompter && !(await confirm(prompter, 'Tiếp tục cài? (y/N)'))) {
      io.stdout.write('Đã hủy, không ghi file nào.\n');
      return 1;
    }
    const report = await applyInstall(catalog, plan);
    io.stdout.write(`\nĐã ghi ${report.added.length} file, nâng cấp ${report.upgraded.length}, giữ nguyên ${report.keptForeign.length + report.keptModified.length} file đã có.\n`);
    printNextSteps(plan.homeDir, io);
    return 0;
  } finally {
    prompter?.close();
  }
}

async function completeInstallRequest(values, catalog, prompter, io) {
  const directory = await requireValue(values.directory, 'directory', prompter, 'Thư mục gốc gf (tạo mới nếu chưa có):');
  const modules = await requireValue(
    values.modules,
    'modules',
    prompter,
    `Module (${[...catalog.modules.keys()].join(', ')}), cách nhau dấu phẩy:`,
  );
  const tools = await requireValue(values.tools, 'tools', prompter, `Tool (${catalog.tools.join(', ')}), cách nhau dấu phẩy:`);
  return {
    homeDir: await resolveHomeDirectory(io.cwd, directory),
    claudeDir: claudeDirOf(io.env),
    modules: parseList(modules, 'modules'),
    tools: parseList(tools, 'tools'),
  };
}

async function requireValue(value, name, prompter, question) {
  if (value) return value;
  if (!prompter) throw new CliError(`Thiếu --${name} (bắt buộc khi dùng --yes)`);
  const answer = await prompter.ask(question);
  if (!answer) throw new CliError(`Thiếu ${name}`);
  return answer;
}

function parseList(value, name) {
  const items = value.split(',').map((item) => item.trim()).filter(Boolean);
  if (!items.length) throw new CliError(`--${name} trống`);
  return items;
}

async function resolveHomeDirectory(cwd, directory) {
  const resolved = path.resolve(cwd, directory);
  const info = await stat(resolved).catch(() => null);
  if (info && !info.isDirectory()) throw new CliError(`${resolved} đã tồn tại nhưng không phải thư mục`);
  return resolved;
}

async function resolveExistingDirectory(cwd, directory, name) {
  if (!directory) throw new CliError(`Thiếu --${name}`);
  const resolved = path.resolve(cwd, directory);
  const info = await stat(resolved).catch(() => null);
  if (!info?.isDirectory()) throw new CliError(`Không tìm thấy thư mục: ${resolved}`);
  return resolved;
}

async function confirm(prompter, question) {
  const answer = await prompter.ask(question);
  return CONFIRM_ANSWERS.includes(answer.toLowerCase());
}

function printPlan(plan, io) {
  io.stdout.write(`Thư mục gốc: ${plan.homeDir}\nSkill và CLI: ${plan.claudeDir}\n`);
  io.stdout.write(`  Module: ${plan.moduleNames.join(', ')} · Tool: ${plan.tools.join(', ')}\n`);
  for (const entry of plan.entries) {
    const label = entry.root === 'claude' ? `[~/.claude] ${entry.target}` : entry.target;
    const marker = entry.exists ? '=' : '+';
    const note = entry.exists ? (entry.root === 'claude' ? ' (đã có, nâng cấp nếu chưa sửa)' : ' (đã tồn tại, bỏ qua)') : '';
    io.stdout.write(`  ${marker} ${label}${note}\n`);
  }
}

function printNextSteps(homeDir, io) {
  io.stdout.write('\nViệc cần làm tiếp:\n');
  io.stdout.write(`  1. Mở Claude Code trong "${homeDir}", gõ /gf-init để link một dự án code\n`);
  io.stdout.write(`  2. Kiểm tra: ${KIT_COMMAND} doctor --directory "${homeDir}"\n`);
}

async function runUpdate(values, io) {
  const catalog = await loadCatalog(KIT_ROOT);
  const homeDir = await resolveExistingDirectory(io.cwd, values.directory, 'directory');
  const report = await applyUpdate(catalog, { homeDir, claudeDir: claudeDirOf(io.env) });
  io.stdout.write(`Cập nhật lên kit ${catalog.version}\n`);
  for (const [kind, title] of UPDATE_SECTIONS) {
    if (!report[kind].length) continue;
    io.stdout.write(`${title}:\n${report[kind].map((target) => `    ${target}`).join('\n')}\n`);
  }
  io.stdout.write(`Không đổi: ${report.unchanged.length} file\n`);
  return 0;
}

async function runInitProject(values, io) {
  const catalog = await loadCatalog(KIT_ROOT);
  const homeDir = await resolveExistingDirectory(io.cwd, values.directory, 'directory');
  if (!values.name) throw new CliError('Thiếu --name');
  if (!values.project) throw new CliError('Thiếu --project');
  const result = await initProject(catalog, {
    homeDir,
    name: values.name,
    projectPath: path.resolve(io.cwd, values.project),
  });
  io.stdout.write(`Đã tạo ${result.projectDir}\n  link → ${result.linkedPath} (nhánh chính: ${result.baseBranch})\n`);
  io.stdout.write('Việc cần làm tiếp: điền lệnh trong config.sh, mục 4.5 của constitution.md, patterns.md; rồi chạy doctor.\n');
  return 0;
}

async function runDoctorCommand(values, io) {
  const homeDir = await resolveExistingDirectory(io.cwd, values.directory, 'directory');
  const checks = await runDoctor({
    homeDir,
    claudeDir: claudeDirOf(io.env),
    autonomous: values.autonomous,
    env: io.env,
  });
  for (const check of checks) io.stdout.write(`${formatCheck(check)}\n`);
  if (values.autonomous) {
    io.stdout.write(`\nTự đối chiếu (doctor không kiểm được):\n${MANUAL_CHECKLIST.map((item) => `  ☐ ${item}`).join('\n')}\n`);
  }
  return checks.some((check) => check.required && !check.ok) ? 1 : 0;
}

function formatCheck(check) {
  const scope = check.autonomousOnly ? ' (chế độ độc lập)' : '';
  if (check.ok) return `✓ ${check.label}${scope}`;
  const marker = check.required ? '✗' : '!';
  return `${marker} ${check.label}${scope} — ${check.hint}`;
}
