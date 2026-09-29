import { spawnSync } from 'node:child_process';

const SCALAR_KEYS = [
  'PROJECT_PATH',
  'BASE_BRANCH',
  'INSTALL_COMMAND',
  'TEST_COMMAND',
  'TEST_MODULE_COMMAND',
  'LINT_COMMAND',
  'E2E_COMMAND',
  'RUN_COMMAND',
  'MAX_AGENT_CALLS_PER_RUN',
  'COMMAND_TIMEOUT_SECONDS',
];
const ARRAY_KEYS = ['MODULE_GLOBS', 'FORBIDDEN_PATHS'];
const DEFAULTS = {
  BASE_BRANCH: 'main',
  MAX_AGENT_CALLS_PER_RUN: '150',
  COMMAND_TIMEOUT_SECONDS: '900',
};

const READ_SCRIPT = [
  'source ./config.sh',
  ...SCALAR_KEYS.map((key) => `printf '%s=%s\\n' ${key} "\${${key}:-}"`),
  ...ARRAY_KEYS.map((key) => `for value in "\${${key}[@]}"; do printf '%s[]=%s\\n' ${key} "$value"; done`),
].join('; ');

export function readProjectConfig(projectDir) {
  const result = spawnSync('bash', ['-c', READ_SCRIPT], { cwd: projectDir, encoding: 'utf8' });
  if (result.status !== 0) return null;
  const initial = Object.fromEntries(ARRAY_KEYS.map((key) => [key, []]));
  const parsed = result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .reduce((config, line) => {
      const separator = line.indexOf('=');
      const key = line.slice(0, separator);
      const value = line.slice(separator + 1);
      if (key.endsWith('[]')) {
        const arrayKey = key.slice(0, -2);
        return { ...config, [arrayKey]: [...config[arrayKey], value] };
      }
      return { ...config, [key]: value };
    }, initial);
  const withDefaults = Object.fromEntries(
    Object.entries(DEFAULTS).map(([key, value]) => [key, parsed[key] || value]),
  );
  return {
    ...parsed,
    ...withDefaults,
    MAX_AGENT_CALLS_PER_RUN: Number(withDefaults.MAX_AGENT_CALLS_PER_RUN),
    COMMAND_TIMEOUT_SECONDS: Number(withDefaults.COMMAND_TIMEOUT_SECONDS),
  };
}
