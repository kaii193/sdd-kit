import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { toPosix } from './catalog.js';
import { CliError } from './errors.js';
import { pathExists, readJsonIfExists, readIfExists, writeEntry, writeJson } from './files.js';
import { isGitRepository, runGit } from './git.js';
import { HOME_MANIFEST, PROJECTS_DIR, SETTINGS_PATH } from './installer.js';

const PROJECT_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UNSAFE_CONFIG_CHARACTERS = /["$`\\\r\n]/;
const DEFAULT_BASE_BRANCH = 'main';
const PROJECT_TEMPLATE_MODULE = 'sdd';
const CONFIG_FILE = 'config.sh';
const SPECS_DIR = 'specs';
const LINKED_PATH_LINE = /^PROJECT_PATH="(.*)"\s*$/m;

export async function initProject(catalog, { homeDir, name, projectPath }) {
  if (!PROJECT_NAME_PATTERN.test(name)) {
    throw new CliError(`Tên dự án không hợp lệ: '${name}' — chỉ chữ thường không dấu, số, nối bằng -`);
  }
  if (!(await readJsonIfExists(path.join(homeDir, HOME_MANIFEST)))) {
    throw new CliError(`${homeDir} không phải thư mục gốc gf (thiếu ${HOME_MANIFEST}). Chạy install trước.`);
  }
  const linkedPath = await validateProjectPath(projectPath);
  const projectDir = path.join(homeDir, PROJECTS_DIR, name);
  if (await pathExists(projectDir)) throw new CliError(`Dự án '${name}' đã tồn tại: ${projectDir}`);
  const owner = (await listProjects(homeDir)).find((project) => samePath(project.linkedPath, linkedPath));
  if (owner) throw new CliError(`${linkedPath} đã được link vào dự án '${owner.name}'`);

  const settingsPath = path.join(homeDir, SETTINGS_PATH);
  const settings = await readSettings(settingsPath);

  const baseBranch = detectBaseBranch(linkedPath);
  const variables = { PROJECT_PATH: linkedPath, BASE_BRANCH: baseBranch };
  for (const file of catalog.modules.get(PROJECT_TEMPLATE_MODULE).layers.project) {
    await writeEntry(projectDir, { ...file, variables }, file.target);
  }
  await mkdir(path.join(projectDir, SPECS_DIR), { recursive: true });
  await writeJson(settingsPath, withAdditionalDirectory(settings, linkedPath));
  return { projectDir, linkedPath, baseBranch };
}

async function validateProjectPath(projectPath) {
  const resolved = path.resolve(projectPath);
  const info = await stat(resolved).catch(() => null);
  if (!info?.isDirectory()) throw new CliError(`Không tìm thấy thư mục dự án: ${resolved}`);
  if (!isGitRepository(resolved)) throw new CliError(`${resolved} không phải git repo`);
  const linkedPath = toPosix(resolved);
  if (UNSAFE_CONFIG_CHARACTERS.test(linkedPath)) {
    throw new CliError(`Đường dẫn chứa ký tự không được phép (" $ \` \\ hoặc xuống dòng): ${linkedPath}`);
  }
  return linkedPath;
}

function detectBaseBranch(linkedPath) {
  const remoteHead = runGit(linkedPath, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  const branch = remoteHead ? remoteHead.replace(/^origin\//, '') : runGit(linkedPath, ['symbolic-ref', '--short', 'HEAD']);
  if (!branch || UNSAFE_CONFIG_CHARACTERS.test(branch)) return DEFAULT_BASE_BRANCH;
  return branch;
}

function withAdditionalDirectory(settings, directory) {
  const permissions = settings.permissions ?? {};
  const directories = permissions.additionalDirectories ?? [];
  if (directories.some((existing) => samePath(existing, directory))) return settings;
  return { ...settings, permissions: { ...permissions, additionalDirectories: [...directories, directory] } };
}

export async function readSettings(settingsPath) {
  const content = await readIfExists(settingsPath);
  if (content === null) return {};
  try {
    return JSON.parse(content.toString('utf8'));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new CliError(`${settingsPath} không phải JSON hợp lệ (${error.message}) — sửa tay rồi chạy lại`);
  }
}

export async function listProjects(homeDir) {
  const projectsRoot = path.join(homeDir, PROJECTS_DIR);
  const entries = await readdir(projectsRoot, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const projects = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const dir = path.join(projectsRoot, entry.name);
        const config = await readIfExists(path.join(dir, CONFIG_FILE));
        const linkedPath = config?.toString('utf8').match(LINKED_PATH_LINE)?.[1] ?? null;
        return { name: entry.name, dir, hasConfig: config !== null, linkedPath };
      }),
  );
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readProjectFile(project, fileName) {
  return readFile(path.join(project.dir, fileName), 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
}

export function samePath(left, right) {
  if (!left || !right) return false;
  const normalize = (value) => toPosix(path.resolve(value)).replace(/\/+$/, '');
  const [a, b] = [normalize(left), normalize(right)];
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}
