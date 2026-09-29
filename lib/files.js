import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EXECUTABLE_EXTENSION = '.sh';
const EXECUTABLE_MODE = 0o755;

export function hashOf(content) {
  return createHash('sha256').update(content).digest('hex');
}

export async function prepareContent(entry) {
  const raw = await readFile(entry.source);
  const rendered = entry.variables ? renderVariables(raw.toString('utf8'), entry.variables) : null;
  if (!isExecutable(entry.target)) return rendered === null ? raw : Buffer.from(rendered, 'utf8');
  return Buffer.from((rendered ?? raw.toString('utf8')).replace(/\r\n/g, '\n'), 'utf8');
}

function renderVariables(text, variables) {
  return Object.entries(variables).reduce((result, [name, value]) => result.replaceAll(`{{${name}}}`, value), text);
}

export async function writeEntry(rootDir, entry, targetRelative) {
  const content = await prepareContent(entry);
  const targetPath = path.join(rootDir, targetRelative);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content);
  if (isExecutable(entry.target)) await chmod(targetPath, EXECUTABLE_MODE);
  return content;
}

function isExecutable(target) {
  return target.endsWith(EXECUTABLE_EXTENSION);
}

export async function readIfExists(filePath) {
  try {
    return await readFile(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function readJsonIfExists(filePath) {
  const content = await readIfExists(filePath);
  return content === null ? null : JSON.parse(content.toString('utf8'));
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
