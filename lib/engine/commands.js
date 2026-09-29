import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { CliError } from '../errors.js';
import { listProjects } from '../projects.js';
import { loadSpecContext, readEvents, readStatus, SPEC_DIR_PATTERN } from './context.js';
import { scanHome } from './home-scan.js';
import { computeMetrics } from './metrics.js';
import { notifyIfChanged, writeSummary } from './report.js';
import {
  importPmTasks,
  planNext,
  recordAssumption,
  recordSkippedAction,
  recordStep,
  relock,
  runMachineStep,
  startRun,
} from './runner.js';
import { Step } from './state-machine.js';

const SPEC_SUBCOMMANDS = {
  start: ({ context, now }) => startRun(context, now),
  next: ({ context, now }) => planNext(context, now),
  record: ({ context, values, now }) =>
    recordStep(context, { task: required(values, 'task'), step: required(values, 'step'), result: required(values, 'result'), note: values.note }, now),
  'load-tasks': ({ context, now }) => importPmTasks(context, now),
  lock: ({ context, values, now }) => runMachineStep(context, Step.Lock, required(values, 'task'), now),
  gate: ({ context, values, now }) => runMachineStep(context, Step.Gate, required(values, 'task'), now),
  relock: ({ context, values, now }) => relock(context, required(values, 'task'), required(values, 'reason'), now),
  assume: ({ context, values }) => recordAssumption(context, values.task, required(values, 'note')),
  'skip-action': ({ context, values }) => recordSkippedAction(context, values.task, required(values, 'note')),
  summary: async ({ context }) => {
    await writeSummary(context);
    return { summary: context.summaryPath };
  },
  notify: ({ context, io }) => notifyIfChanged(context, io.env),
};

const HOME_SUBCOMMANDS = {
  scan: ({ homeDir, now }) => scanHome(homeDir, now),
  metrics: ({ homeDir }) => metricsForHome(homeDir),
};

export const RUN_USAGE = `Dùng (trong thư mục gốc gf, hoặc thêm --directory):
  run scan                                   quyết định việc cho mọi spec (runner mỗi giờ)
  run start      <spec>                      bắt đầu hoặc làm tiếp một spec
  run next       <spec>                      bước kế tiếp phải làm
  run load-tasks <spec>                      nạp pm-tasks.json của PM
  run record     <spec> --task P1 --step <stub|tests|implement|review|qc> --result <pass|fail|blocked|policy> [--note ...]
  run lock|gate  <spec> --task P1            bước máy: khóa test / gate
  run relock     <spec> --task P1 --reason "AC-x ..."   QC sửa test đã khóa
  run assume     <spec> [--task P1] --note "..."        ghi giả định agent tự chọn
  run skip-action <spec> [--task P1] --note "..."       ghi hành động bị cấm đã bỏ qua
  run summary|notify <spec>                  viết runs/summary.md / gửi Telegram nếu trạng thái đổi
  run metrics                                chỉ số của mọi spec`;

export async function runEngineCommand(values, io, positionals) {
  const [, subcommand, specArg] = positionals;
  const homeDir = path.resolve(io.cwd, values.directory ?? '.');
  const now = values.now ?? new Date().toISOString();
  if (HOME_SUBCOMMANDS[subcommand]) return HOME_SUBCOMMANDS[subcommand]({ homeDir, now, values, io });
  if (!subcommand || subcommand === 'help') throw new CliError(RUN_USAGE);
  const handler = SPEC_SUBCOMMANDS[subcommand];
  if (!handler) throw new CliError(`Lệnh con không hợp lệ: ${subcommand}\n${RUN_USAGE}`);
  if (!specArg) throw new CliError(`Thiếu <spec> (vd: projects/shop-api/specs/001-ap-ma)\n${RUN_USAGE}`);
  const context = await loadSpecContext(homeDir, specArg);
  return handler({ context, values, now, io });
}

async function metricsForHome(homeDir) {
  const projects = await listProjects(homeDir);
  const runs = [];
  for (const project of projects) {
    const specsDir = path.join(project.dir, 'specs');
    for (const specName of await listSpecNames(specsDir)) {
      const context = await loadSpecContext(homeDir, path.join(specsDir, specName));
      const status = await readStatus(context);
      if (status) runs.push({ status, events: await readEvents(context.eventsPath) });
    }
  }
  return computeMetrics(runs);
}

async function listSpecNames(specsDir) {
  const entries = await readdir(specsDir, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  return entries.filter((entry) => entry.isDirectory() && SPEC_DIR_PATTERN.test(entry.name)).map((entry) => entry.name);
}

function required(values, name) {
  if (!values[name]) throw new CliError(`Thiếu --${name}`);
  return values[name];
}
