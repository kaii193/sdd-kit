import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CliError } from './errors.js';

export const MANIFEST_PATH = '.gf/manifest.json';
const EXECUTABLE_EXTENSION = '.sh';
const EXECUTABLE_MODE = 0o755;
const PENDING_UPDATE_SUFFIX = '.gf-new';

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

export async function planInstall(catalog, request) {
  if (await readManifest(request.directory)) {
    throw new CliError(`Kit đã được cài tại ${request.directory}. Dùng lệnh update.`);
  }
  const moduleNames = resolveModules(catalog, request.modules);
  validateTools(catalog, moduleNames, request.tools);
  const entries = collectEntries(catalog, { moduleNames, tools: request.tools, includeCi: request.includeCi });
  const plannedEntries = await Promise.all(
    entries.map(async (entry) => ({ ...entry, exists: await pathExists(path.join(request.directory, entry.target)) })),
  );
  return { ...request, moduleNames, entries: plannedEntries };
}

export async function applyInstall(catalog, plan) {
  const files = {};
  const written = [];
  const skipped = [];
  for (const entry of plan.entries) {
    if (entry.exists) {
      skipped.push(entry.target);
      continue;
    }
    const content = await writeKitFile(plan.directory, entry, entry.target);
    files[entry.target] = recordOf(entry, content);
    written.push(entry.target);
  }
  await writeManifest(plan.directory, {
    kitVersion: catalog.version,
    modules: plan.moduleNames,
    tools: plan.tools,
    includeCi: plan.includeCi,
    files,
  });
  return { written, skipped };
}

export async function applyUpdate(catalog, directory) {
  const manifest = await readManifest(directory);
  if (!manifest) {
    throw new CliError(`Chưa cài kit tại ${directory} (thiếu ${MANIFEST_PATH}). Dùng lệnh install.`);
  }
  const entries = collectEntries(catalog, {
    moduleNames: manifest.modules,
    tools: manifest.tools,
    includeCi: manifest.includeCi,
  });
  const files = { ...manifest.files };
  const report = { added: [], upgraded: [], unchanged: [], keptUser: [], keptModified: [], keptForeign: [] };
  for (const entry of entries) {
    const outcome = await updateEntry(directory, entry, files[entry.target]);
    report[outcome.kind].push(entry.target);
    if (outcome.record) files[entry.target] = outcome.record;
  }
  await writeManifest(directory, { ...manifest, kitVersion: catalog.version, files });
  return report;
}

async function updateEntry(directory, entry, recorded) {
  if (entry.owner === 'user') return { kind: 'keptUser' };
  const current = await readIfExists(path.join(directory, entry.target));
  if (current === null) {
    const content = await writeKitFile(directory, entry, entry.target);
    return { kind: 'added', record: recordOf(entry, content) };
  }
  if (!recorded) return { kind: 'keptForeign' };
  if (hashOf(current) !== recorded.hash) {
    await writeKitFile(directory, entry, `${entry.target}${PENDING_UPDATE_SUFFIX}`);
    return { kind: 'keptModified' };
  }
  const content = await prepareContent(entry);
  if (hashOf(content) === recorded.hash) return { kind: 'unchanged' };
  await writeKitFile(directory, entry, entry.target);
  return { kind: 'upgraded', record: recordOf(entry, content) };
}

function collectEntries(catalog, { moduleNames, tools, includeCi }) {
  return moduleNames.flatMap((name) => {
    const module = catalog.modules.get(name);
    const toolEntries = tools.flatMap((tool) => module.toolFiles[tool] ?? []);
    return [...module.files, ...toolEntries]
      .filter((entry) => includeCi || !isCiPath(module, entry.target))
      .map((entry) => ({ ...entry, module: name, owner: ownerOf(module, entry.target) }));
  });
}

function isCiPath(module, target) {
  return module.ciPaths.some((ciPath) => target.startsWith(ciPath));
}

function ownerOf(module, target) {
  return module.userOwned.includes(target) ? 'user' : 'kit';
}

function recordOf(entry, content) {
  return { module: entry.module, owner: entry.owner, hash: hashOf(content) };
}

async function writeKitFile(directory, entry, targetRelative) {
  const content = await prepareContent(entry);
  const targetPath = path.join(directory, targetRelative);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content);
  if (isExecutable(entry.target)) await chmod(targetPath, EXECUTABLE_MODE);
  return content;
}

async function prepareContent(entry) {
  const content = await readFile(entry.source);
  if (!isExecutable(entry.target)) return content;
  return Buffer.from(content.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
}

function isExecutable(target) {
  return target.endsWith(EXECUTABLE_EXTENSION);
}

function hashOf(content) {
  return createHash('sha256').update(content).digest('hex');
}

export async function readManifest(directory) {
  const content = await readIfExists(path.join(directory, MANIFEST_PATH));
  return content === null ? null : JSON.parse(content.toString('utf8'));
}

async function writeManifest(directory, manifest) {
  const manifestPath = path.join(directory, MANIFEST_PATH);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function readIfExists(filePath) {
  try {
    return await readFile(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
