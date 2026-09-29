import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const MODULES_DIR = 'modules';
const MODULE_DEFINITION = 'module.json';
const FILES_DIR = 'files';
const TOOLS_DIR = 'tools';

export async function loadCatalog(kitRoot) {
  const modulesRoot = path.join(kitRoot, MODULES_DIR);
  const names = await listDirectories(modulesRoot);
  const modules = await Promise.all(names.map((name) => loadModule(path.join(modulesRoot, name))));
  const tools = [...new Set(modules.flatMap((module) => Object.keys(module.toolFiles)))].sort();
  const packageJson = JSON.parse(await readFile(path.join(kitRoot, 'package.json'), 'utf8'));
  return {
    version: packageJson.version,
    tools,
    modules: new Map(modules.map((module) => [module.name, module])),
  };
}

async function loadModule(moduleRoot) {
  const definition = JSON.parse(await readFile(path.join(moduleRoot, MODULE_DEFINITION), 'utf8'));
  const files = await listFiles(path.join(moduleRoot, FILES_DIR));
  const toolNames = await listDirectories(path.join(moduleRoot, TOOLS_DIR));
  const toolEntries = await Promise.all(
    toolNames.map(async (tool) => [tool, await listFiles(path.join(moduleRoot, TOOLS_DIR, tool))]),
  );
  return { ...definition, files, toolFiles: Object.fromEntries(toolEntries) };
}

async function listDirectories(dir) {
  const entries = await readDirectoryIfExists(dir);
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function listFiles(root) {
  const sources = await walkFiles(root);
  return sources
    .map((source) => ({ source, target: path.relative(root, source).split(path.sep).join('/') }))
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

async function readDirectoryIfExists(dir) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
