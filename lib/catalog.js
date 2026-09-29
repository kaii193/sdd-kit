import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const MODULES_DIR = 'modules';
const MODULE_DEFINITION = 'module.json';
const LAYER_DIRS = { home: 'home', project: 'project', claude: 'claude' };
const TOOLS_DIR = 'tools';
const KIT_COPY_SOURCES = ['bin', 'lib', 'modules'];
const KIT_MANIFEST = 'package.json';

export async function loadCatalog(kitRoot) {
  const modulesRoot = path.join(kitRoot, MODULES_DIR);
  const names = await listDirectories(modulesRoot);
  const modules = await Promise.all(names.map((name) => loadModule(path.join(modulesRoot, name))));
  const tools = [...new Set(modules.flatMap((module) => Object.keys(module.toolFiles)))].sort();
  const packageJson = JSON.parse(await readFile(path.join(kitRoot, KIT_MANIFEST), 'utf8'));
  return {
    version: packageJson.version,
    tools,
    modules: new Map(modules.map((module) => [module.name, module])),
    kitFiles: await listKitFiles(kitRoot),
  };
}

async function loadModule(moduleRoot) {
  const definition = JSON.parse(await readFile(path.join(moduleRoot, MODULE_DEFINITION), 'utf8'));
  const layers = Object.fromEntries(
    await Promise.all(
      Object.entries(LAYER_DIRS).map(async ([layer, dir]) => [layer, await listFiles(path.join(moduleRoot, dir))]),
    ),
  );
  const toolNames = await listDirectories(path.join(moduleRoot, TOOLS_DIR));
  const toolEntries = await Promise.all(
    toolNames.map(async (tool) => [tool, await listFiles(path.join(moduleRoot, TOOLS_DIR, tool))]),
  );
  return { ...definition, layers, toolFiles: Object.fromEntries(toolEntries) };
}

async function listKitFiles(kitRoot) {
  const nested = await Promise.all(KIT_COPY_SOURCES.map((dir) => walkFiles(path.join(kitRoot, dir))));
  return [...nested.flat(), path.join(kitRoot, KIT_MANIFEST)]
    .map((source) => ({ source, target: toPosix(path.relative(kitRoot, source)) }))
    .sort((a, b) => a.target.localeCompare(b.target));
}

async function listFiles(root) {
  const sources = await walkFiles(root);
  return sources
    .map((source) => ({ source, target: toPosix(path.relative(root, source)) }))
    .sort((a, b) => a.target.localeCompare(b.target));
}

async function walkFiles(dir) {
  const entries = await readDirectoryIfExists(dir);
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(dir, entry.name);
      return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
    }),
  );
  return nested.flat();
}

async function listDirectories(dir) {
  const entries = await readDirectoryIfExists(dir);
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function readDirectoryIfExists(dir) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}
