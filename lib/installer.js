import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { toPosix } from './catalog.js';
import { CliError } from './errors.js';
import { hashOf, pathExists, prepareContent, readIfExists, readJsonIfExists, writeEntry, writeJson } from './files.js';

export const HOME_MANIFEST = '.gf/manifest.json';
export const CLAUDE_MANIFEST = 'gf/manifest.json';
export const KIT_COPY_DIR = 'gf/kit';
export const KIT_BIN = 'bin/gf.js';
export const PROJECTS_DIR = 'projects';
export const SETTINGS_PATH = '.claude/settings.json';
const PENDING_UPDATE_SUFFIX = '.gf-new';
export const DENY_RULES = [
  'Bash(git push --force *)',
  'Bash(git push -f *)',
  'Bash(git push --force-with-lease *)',
  'Bash(gh pr merge *)',
  'Edit(**/deploy/**)',
  'Read(**/.env)',
  'Read(**/.env.*)',
];
const DEFAULT_SETTINGS = { permissions: { additionalDirectories: [], deny: DENY_RULES } };

export function resolveModules(catalog, requestedNames) {
  const ordered = [];
  const visit = (name) => {
    if (ordered.includes(name)) return;
    const module = catalog.modules.get(name);
    if (!module) {
      throw new CliError(`Module không tồn tại: ${name}. Có: ${[...catalog.modules.keys()].join(', ')}`);
    }
    module.requires.forEach(visit);
    ordered.push(name);
  };
  requestedNames.forEach(visit);
  return ordered;
}

export function validateTools(catalog, moduleNames, tools) {
  const unknownTools = tools.filter((tool) => !catalog.tools.includes(tool));
  if (unknownTools.length) {
    throw new CliError(`Tool không hỗ trợ: ${unknownTools.join(', ')}. Có: ${catalog.tools.join(', ')}`);
  }
  for (const name of moduleNames) {
    const missingTools = catalog.modules.get(name).requiresTools.filter((tool) => !tools.includes(tool));
    if (missingTools.length) {
      throw new CliError(`Module '${name}' cần tool: ${missingTools.join(', ')}. Thêm vào --tools.`);
    }
  }
}

export function kitBinPath(claudeDir) {
  return toPosix(path.join(claudeDir, KIT_COPY_DIR, KIT_BIN));
}

export async function planInstall(catalog, request) {
  if (await readJsonIfExists(path.join(request.homeDir, HOME_MANIFEST))) {
    throw new CliError(`Kit đã được cài tại ${request.homeDir}. Dùng lệnh update.`);
  }
  const moduleNames = resolveModules(catalog, request.modules);
  validateTools(catalog, moduleNames, request.tools);
  const roots = { home: request.homeDir, claude: request.claudeDir };
  const entries = collectEntries(catalog, { moduleNames, tools: request.tools, claudeDir: request.claudeDir });
  const plannedEntries = await Promise.all(
    entries.map(async (entry) => ({ ...entry, exists: await pathExists(path.join(roots[entry.root], entry.target)) })),
  );
  return { ...request, moduleNames, roots, entries: plannedEntries };
}

export async function applyInstall(catalog, plan) {
  const claudeManifest = await readJsonIfExists(path.join(plan.claudeDir, CLAUDE_MANIFEST));
  const homeFiles = {};
  const claudeFiles = { ...(claudeManifest?.files ?? {}) };
  const report = emptyReport();
  for (const entry of plan.entries) {
    if (entry.root === 'claude') {
      const outcome = await syncKitEntry(plan.claudeDir, entry, claudeFiles[entry.target]);
      report[outcome.kind].push(displayTarget(entry));
      if (outcome.record) claudeFiles[entry.target] = outcome.record;
      continue;
    }
    if (entry.exists) {
      report.keptForeign.push(displayTarget(entry));
      continue;
    }
    const content = await writeEntry(plan.homeDir, entry, entry.target);
    homeFiles[entry.target] = recordOf(entry, content);
    report.added.push(displayTarget(entry));
  }
  await prepareHome(plan.homeDir);
  await writeJson(path.join(plan.homeDir, HOME_MANIFEST), {
    kitVersion: catalog.version,
    modules: plan.moduleNames,
    tools: plan.tools,
    files: homeFiles,
  });
  await writeClaudeManifest(catalog, plan.claudeDir, claudeManifest, plan.homeDir, claudeFiles);
  return report;
}

export async function applyUpdate(catalog, { homeDir, claudeDir }) {
  const homeManifest = await readJsonIfExists(path.join(homeDir, HOME_MANIFEST));
  if (!homeManifest) {
    throw new CliError(`Chưa cài kit tại ${homeDir} (thiếu ${HOME_MANIFEST}). Dùng lệnh install.`);
  }
  const claudeManifest = await readJsonIfExists(path.join(claudeDir, CLAUDE_MANIFEST));
  const files = { home: { ...homeManifest.files }, claude: { ...(claudeManifest?.files ?? {}) } };
  const roots = { home: homeDir, claude: claudeDir };
  const report = emptyReport();
  const entries = collectEntries(catalog, { moduleNames: homeManifest.modules, tools: homeManifest.tools, claudeDir });
  for (const entry of entries) {
    const outcome = await syncKitEntry(roots[entry.root], entry, files[entry.root][entry.target]);
    report[outcome.kind].push(displayTarget(entry));
    if (outcome.record) files[entry.root][entry.target] = outcome.record;
  }
  await prepareHome(homeDir);
  await writeJson(path.join(homeDir, HOME_MANIFEST), { ...homeManifest, kitVersion: catalog.version, files: files.home });
  await writeClaudeManifest(catalog, claudeDir, claudeManifest, homeDir, files.claude);
  return report;
}

async function syncKitEntry(rootDir, entry, recorded) {
  if (entry.owner === 'user') return { kind: 'keptUser' };
  const current = await readIfExists(path.join(rootDir, entry.target));
  if (current === null) {
    const content = await writeEntry(rootDir, entry, entry.target);
    return { kind: 'added', record: recordOf(entry, content) };
  }
  if (!recorded) return { kind: 'keptForeign' };
  if (hashOf(current) !== recorded.hash) {
    await writeEntry(rootDir, entry, `${entry.target}${PENDING_UPDATE_SUFFIX}`);
    return { kind: 'keptModified' };
  }
  const content = await prepareContent(entry);
  if (hashOf(content) === recorded.hash) return { kind: 'unchanged' };
  await writeEntry(rootDir, entry, entry.target);
  return { kind: 'upgraded', record: recordOf(entry, content) };
}

function collectEntries(catalog, { moduleNames, tools, claudeDir }) {
  const variables = { GF_KIT_BIN: kitBinPath(claudeDir) };
  const moduleEntries = moduleNames.flatMap((name) => {
    const module = catalog.modules.get(name);
    const toolEntries = tools.flatMap((tool) => module.toolFiles[tool] ?? []);
    const homeEntries = [...module.layers.home, ...toolEntries].map((file) => ({
      ...file,
      root: 'home',
      module: name,
      owner: module.userOwned.includes(file.target) ? 'user' : 'kit',
      variables,
    }));
    const claudeEntries = module.layers.claude.map((file) => ({
      ...file,
      root: 'claude',
      module: name,
      owner: 'kit',
      variables,
    }));
    return [...homeEntries, ...claudeEntries];
  });
  const kitEntries = catalog.kitFiles.map((file) => ({
    ...file,
    target: `${KIT_COPY_DIR}/${file.target}`,
    root: 'claude',
    module: 'kit',
    owner: 'kit',
  }));
  return [...moduleEntries, ...kitEntries];
}

async function prepareHome(homeDir) {
  await mkdir(path.join(homeDir, PROJECTS_DIR), { recursive: true });
  const settingsPath = path.join(homeDir, SETTINGS_PATH);
  if (!(await pathExists(settingsPath))) await writeJson(settingsPath, DEFAULT_SETTINGS);
}

async function writeClaudeManifest(catalog, claudeDir, previous, homeDir, files) {
  const homes = [...new Set([...(previous?.homes ?? []), toPosix(homeDir)])];
  await writeJson(path.join(claudeDir, CLAUDE_MANIFEST), { kitVersion: catalog.version, homes, files });
}

function recordOf(entry, content) {
  return { module: entry.module, owner: entry.owner, hash: hashOf(content) };
}

function displayTarget(entry) {
  return entry.root === 'claude' ? `[~/.claude] ${entry.target}` : entry.target;
}

function emptyReport() {
  return { added: [], upgraded: [], unchanged: [], keptUser: [], keptModified: [], keptForeign: [] };
}
