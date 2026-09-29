import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createSandbox, install, KIT_ROOT, linkProject, projectPath, readJson, readText, runCli, writeText } from './helpers.js';

export const SPEC = 'projects/shop/specs/001-ap-ma-giam-gia';
export const ITEMS = 'const items = [{ price: 500000, quantity: 1 }];';
export const PRICING = 'src/pricing/index.js';
export const STUB = `import { cartTotal } from '../cart/index.js';

export function priceOrder(items, code) {
  const subtotal = cartTotal(items);
  return { subtotal, total: subtotal };
}
`;
export const DISCOUNT_ONLY = `import { cartTotal } from '../cart/index.js';

const DISCOUNTS = { GIAM50K: 50000 };

export function priceOrder(items, code) {
  const subtotal = cartTotal(items);
  return { subtotal, total: subtotal - (DISCOUNTS[code] ?? 0) };
}
`;
export const WITH_EXPIRY = `import { cartTotal } from '../cart/index.js';

const DISCOUNTS = { GIAM50K: 50000 };
const EXPIRED = ['HETHAN'];

export function priceOrder(items, code) {
  if (EXPIRED.includes(code)) {
    const error = new Error(\`Mã \${code} đã hết hạn\`);
    error.code = 'PROMO_EXPIRED';
    throw error;
  }
  const subtotal = cartTotal(items);
  return { subtotal, total: subtotal - (DISCOUNTS[code] ?? 0) };
}
`;
export const AC1_TEST = `import assert from 'node:assert/strict';
import test from 'node:test';
import { priceOrder } from '../src/pricing/index.js';

${ITEMS}

test('AC-1 trừ 50.000đ với mã GIAM50K', () => {
  const order = priceOrder(items, 'GIAM50K');
  assert.equal(order.total, 450000);
  assert.equal(order.subtotal, 500000);
});
`;
export const AC2_TEST = `import assert from 'node:assert/strict';
import test from 'node:test';
import { priceOrder } from '../src/pricing/index.js';

${ITEMS}

test('AC-2 từ chối mã HETHAN', () => {
  assert.throws(() => priceOrder(items, 'HETHAN'), { code: 'PROMO_EXPIRED' });
});
`;
export const PM_TASKS = {
  tasks: [
    { id: 'P1', title: 'Áp mã còn hạn', acs: ['AC-1'] },
    { id: 'P2', title: 'Từ chối mã hết hạn', acs: ['AC-2'], dependsOn: ['P1'] },
  ],
};

export function git(cwd, args) {
  const result = spawnSync('git', ['-c', 'user.email=test@example.com', '-c', 'user.name=test', ...args], {
    cwd,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

export function createEngine(t, { configure = (config) => config } = {}) {
  const sandbox = createSandbox(t);
  install(sandbox);
  const repo = path.join(sandbox.root, 'code', 'shop-api');
  cpSync(path.join(KIT_ROOT, 'examples', 'shop-api'), repo, { recursive: true });
  spawnSync('git', ['init', '-q', '-b', 'main', repo]);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-qm', 'base']);
  linkProject(sandbox, 'shop', repo);
  const configPath = projectPath(sandbox, 'shop', 'config.sh');
  writeText(
    configPath,
    configure(
      readText(configPath)
        .replace('TEST_COMMAND=""', 'TEST_COMMAND="node --test"')
        .replace('LINT_COMMAND=""', 'LINT_COMMAND="node scripts/lint.js"'),
    ),
  );
  cpSync(path.join(KIT_ROOT, 'examples', 'specs', '001-ap-ma-giam-gia'), path.join(sandbox.home, SPEC), { recursive: true });

  const engine = {
    sandbox,
    repo,
    run(args, env) {
      const result = runCli(sandbox, ['run', ...args, '--directory', sandbox.home], { env });
      return { ...result, json: parseJson(result.stdout) };
    },
    status() {
      return readJson(path.join(sandbox.home, SPEC, 'status.json'));
    },
    task(id) {
      return engine.status().tasks.find((task) => task.id === id);
    },
    worktree() {
      return engine.status().worktree;
    },
    commit(files, message) {
      for (const [file, content] of Object.entries(files)) {
        const target = path.join(engine.worktree(), file);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, content);
      }
      git(engine.worktree(), ['add', '-A']);
      git(engine.worktree(), ['commit', '--allow-empty', '-qm', message]);
    },
    record(task, step, result, note = '') {
      return engine.run(['record', SPEC, '--task', task, '--step', step, '--result', result, '--note', note]);
    },
    startWithTasks(pmTasks = PM_TASKS) {
      engine.run(['start', SPEC]);
      writeFileSync(path.join(sandbox.home, SPEC, 'pm-tasks.json'), JSON.stringify(pmTasks));
      return engine.run(['load-tasks', SPEC]);
    },
    reachImplement(task, { stub = STUB, testFile, testContent }) {
      engine.commit({ [PRICING]: stub }, `stub ${task}`);
      engine.record(task, 'stub', 'pass');
      engine.commit({ [testFile]: testContent }, `test ${task}`);
      engine.record(task, 'tests', 'pass');
      return engine.run(['lock', SPEC, '--task', task]);
    },
    finishRound(task) {
      engine.record(task, 'review', 'pass');
      return engine.record(task, 'qc', 'pass');
    },
  };
  return engine;
}

export function parseJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export function runWithoutBlocking(engine, args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(KIT_ROOT, 'bin', 'gf.js'), 'run', ...args, '--directory', engine.sandbox.home], {
      env: { ...process.env, CLAUDE_CONFIG_DIR: engine.sandbox.claude, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (status) => resolve({ status, stdout, stderr, json: parseJson(stdout) }));
  });
}
