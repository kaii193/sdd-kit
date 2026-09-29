import { appendFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { toPosix } from '../catalog.js';
import { CliError } from '../errors.js';
import { hashOf, readJsonIfExists, writeJson } from '../files.js';
import { PROJECTS_DIR } from '../installer.js';
import { readProjectConfig } from '../project-config.js';

const SPECS_DIR = 'specs';
export const SPEC_DIR_PATTERN = /^\d{3}-[a-z0-9-]+$/;
const WORKTREES_DIR = '.worktrees';
const STATUS_LINE = /^\*\*Trạng thái:\*\*\s*(\S+)/m;
const AC_HEADING = /^\*\*(AC-\d+)\*\*/gm;

export async function loadSpecContext(homeDir, specArg) {
  const specDir = path.resolve(homeDir, specArg);
  const info = await stat(specDir).catch(() => null);
  if (!info?.isDirectory()) throw new CliError(`Không tìm thấy thư mục spec: ${specDir}`);
  const specsDir = path.dirname(specDir);
  const projectDir = path.dirname(specsDir);
  const specName = path.basename(specDir);
  if (path.basename(specsDir) !== SPECS_DIR || path.basename(path.dirname(projectDir)) !== PROJECTS_DIR) {
    throw new CliError(`${specDir} phải nằm trong ${PROJECTS_DIR}/<dự-án>/${SPECS_DIR}/`);
  }
  if (!SPEC_DIR_PATTERN.test(specName)) throw new CliError(`Tên thư mục spec không hợp lệ: ${specName} (dạng NNN-ten)`);
  const config = readProjectConfig(projectDir);
  if (!config) throw new CliError(`Không đọc được ${path.join(projectDir, 'config.sh')}`);
  const projectName = path.basename(projectDir);
  return {
    homeDir,
    specDir,
    specName,
    projectDir,
    projectName,
    config,
    specPath: path.join(specDir, 'spec.md'),
    statusPath: path.join(specDir, 'status.json'),
    pmTasksPath: path.join(specDir, 'pm-tasks.json'),
    eventsPath: path.join(specDir, 'runs', 'events.jsonl'),
    summaryPath: path.join(specDir, 'runs', 'summary.md'),
    worktreePath: toPosix(path.join(homeDir, WORKTREES_DIR, projectName, specName)),
    branch: `feat/${specName}`,
  };
}

export async function readSpecFacts(specPath) {
  const text = (await readFile(specPath, 'utf8')).replace(/\r\n/g, '\n');
  return {
    specStatus: text.match(STATUS_LINE)?.[1] ?? null,
    specHash: hashOf(text),
    acs: [...text.matchAll(AC_HEADING)].map((match) => match[1]),
  };
}

export function readStatus(context) {
  return readJsonIfExists(context.statusPath);
}

export function writeStatus(context, status) {
  return writeJson(context.statusPath, status);
}

export async function appendEvent(context, event) {
  await mkdir(path.dirname(context.eventsPath), { recursive: true });
  await appendFile(context.eventsPath, `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`);
}

export async function readEvents(eventsPath) {
  const content = await readFile(eventsPath, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  return content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}
