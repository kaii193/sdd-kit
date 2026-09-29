import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SOURCE_ROOTS = ['src', 'test'];

function listJavaScriptFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const entryPath = path.join(dir, name);
    if (statSync(entryPath).isDirectory()) return listJavaScriptFiles(entryPath);
    return entryPath.endsWith('.js') ? [entryPath] : [];
  });
}

const files = SOURCE_ROOTS.filter((root) => statSync(root, { throwIfNoEntry: false })?.isDirectory()).flatMap(listJavaScriptFiles);
const failures = files.filter((file) => spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' }).status !== 0);

if (failures.length) {
  console.error(`lint: ${failures.length} file lỗi cú pháp`);
  process.exit(1);
}
console.log(`lint: ${files.length} file OK`);
