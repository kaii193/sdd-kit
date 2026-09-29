import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadCatalog } from './catalog.js';
import { MANUAL_CHECKLIST, runDoctor } from './doctor.js';
import { CliError } from './errors.js';
import { applyInstall, applyUpdate, planInstall } from './installer.js';
import { createPrompter } from './prompt.js';

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT_COMMAND = 'npx github:kaii193/sdd-kit';
const CONFIRM_ANSWERS = ['y', 'yes', 'c', 'có'];

const USAGE = `Dùng:
  ${KIT_COMMAND} install --directory <thư-mục> --modules <m1,m2> --tools <t1,t2> [--no-ci] [--yes]
  ${KIT_COMMAND} update  --directory <thư-mục>
  ${KIT_COMMAND} doctor  --directory <thư-mục> [--autonomous]`;

const OPTIONS = {
  directory: { type: 'string' },
  modules: { type: 'string' },
  tools: { type: 'string' },
  'no-ci': { type: 'boolean', default: false },
  yes: { type: 'boolean', short: 'y', default: false },
  autonomous: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
};

const COMMANDS = { install: runInstall, update: runUpdate, doctor: runDoctorCommand };

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

async function runInstall(values, io) {
  const catalog = await loadCatalog(KIT_ROOT);
  const prompter = values.yes ? null : createPrompter(io.stdin, io.stdout);
  try {
    const request = await completeInstallRequest(values, catalog, prompter, io.cwd);
    const plan = await planInstall(catalog, request);
    printPlan(plan, io);
    if (prompter && !(await confirm(prompter, 'Tiếp tục cài? (y/N)'))) {
      io.stdout.write('Đã hủy, không ghi file nào.\n');
      return 1;
    }
    const result = await applyInstall(catalog, plan);
    printInstallResult(plan, result, io);
    return 0;
  } finally {
    prompter?.close();
  }
}

async function completeInstallRequest(values, catalog, prompter, cwd) {
  const directory = await requireValue(values.directory, 'directory', prompter, 'Thư mục dự án:');
  const modules = await requireValue(
    values.modules,
    'modules',
    prompter,
    `Module (${[...catalog.modules.keys()].join(', ')}), cách nhau dấu phẩy:`,
  );
  const tools = await requireValue(values.tools, 'tools', prompter, `Tool (${catalog.tools.join(', ')}), cách nhau dấu phẩy:`);
  return {
    directory: await resolveDirectory(cwd, directory),
    modules: parseList(modules, 'modules'),
    tools: parseList(tools, 'tools'),
    includeCi: !values['no-ci'],
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

async function resolveDirectory(cwd, directory) {
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
  io.stdout.write(`Cài vào ${plan.directory}\n`);
  io.stdout.write(`  Module: ${plan.moduleNames.join(', ')} · Tool: ${plan.tools.join(', ')}${plan.includeCi ? '' : ' · không cài CI'}\n`);
  for (const entry of plan.entries) {
    io.stdout.write(entry.exists ? `  = ${entry.target} (đã tồn tại, bỏ qua)\n` : `  + ${entry.target}\n`);
  }
}

function printInstallResult(plan, result, io) {
  io.stdout.write(`\nĐã ghi ${result.written.length} file, bỏ qua ${result.skipped.length} file đã tồn tại.\n`);
  io.stdout.write(`\nViệc cần làm tiếp:\n`);
  io.stdout.write(`  1. Điền AGENTS.md mục 7, sdd/config.sh, sdd/constitution.md, sdd/patterns.md (sdd/GUIDE.md mục 2–4)\n`);
  io.stdout.write(`  2. Kiểm tra: ${KIT_COMMAND} doctor --directory "${plan.directory}"\n`);
}

async function runUpdate(values, io) {
  if (!values.directory) throw new CliError('Thiếu --directory');
  const catalog = await loadCatalog(KIT_ROOT);
  const directory = await resolveDirectory(io.cwd, values.directory);
  const report = await applyUpdate(catalog, directory);
  printUpdateReport(catalog, report, io);
  return 0;
}

function printUpdateReport(catalog, report, io) {
  const sections = [
    ['added', '+ thêm mới'],
    ['upgraded', '↑ nâng cấp'],
    ['keptModified', '! bạn đã sửa — giữ nguyên, bản mới ghi vào *.gf-new'],
    ['keptUser', '= file của bạn — không đụng'],
    ['keptForeign', '= có từ trước khi cài kit — không đụng'],
  ];
  io.stdout.write(`Cập nhật lên kit ${catalog.version}\n`);
  for (const [kind, title] of sections) {
    if (!report[kind].length) continue;
    io.stdout.write(`${title}:\n${report[kind].map((target) => `    ${target}`).join('\n')}\n`);
  }
  io.stdout.write(`Không đổi: ${report.unchanged.length} file\n`);
}

async function runDoctorCommand(values, io) {
  if (!values.directory) throw new CliError('Thiếu --directory');
  const directory = await resolveDirectory(io.cwd, values.directory);
  const checks = await runDoctor(directory, { autonomous: values.autonomous, env: io.env });
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
