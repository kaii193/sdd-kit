import assert from 'node:assert/strict';
import { rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { readText } from './helpers.js';
import { AC1_TEST, AC2_TEST, createEngine, DISCOUNT_ONLY, PM_TASKS, PRICING, runWithoutBlocking, SPEC, STUB, WITH_EXPIRY } from './engine-fixture.js';

test('drives a spec to done through the real lock and gate on the example app', (t) => {
  const engine = createEngine(t);
  assert.equal(engine.run(['scan']).json[0].action, 'start');
  engine.run(['start', SPEC]);
  assert.equal(engine.run(['next', SPEC]).json.agent, 'gf-pm');
  writeFileSync(path.join(engine.sandbox.home, SPEC, 'pm-tasks.json'), JSON.stringify(PM_TASKS));
  assert.equal(engine.run(['load-tasks', SPEC]).json.ok, true);
  assert.equal(engine.run(['next', SPEC]).json.step, 'stub');

  const lock = engine.reachImplement('P1', { testFile: 'test/pricing-promo.test.js', testContent: AC1_TEST });
  assert.equal(lock.json.result, 'pass', lock.stdout);
  engine.commit({ [PRICING]: DISCOUNT_ONLY }, 'implement P1');
  engine.record('P1', 'implement', 'pass');
  const gate = engine.run(['gate', SPEC, '--task', 'P1']);
  assert.equal(gate.json.result, 'pass', gate.stdout);
  engine.finishRound('P1');

  assert.equal(engine.task('P1').state, 'done');
  assert.equal(engine.task('P1').branch, 'feat/001-ap-ma-giam-gia-p1');
  assert.equal(engine.task('P2').branch, 'feat/001-ap-ma-giam-gia-p2');
  assert.equal(engine.task('P2').baseBranch, 'feat/001-ap-ma-giam-gia-p1');

  assert.equal(engine.reachImplement('P2', { stub: DISCOUNT_ONLY, testFile: 'test/pricing-expiry.test.js', testContent: AC2_TEST }).json.result, 'pass');
  engine.commit({ [PRICING]: WITH_EXPIRY }, 'implement P2');
  engine.record('P2', 'implement', 'pass');
  assert.equal(engine.run(['gate', SPEC, '--task', 'P2']).json.result, 'pass');
  engine.finishRound('P2');

  assert.equal(engine.status().state, 'done');
  assert.equal(engine.run(['scan']).json[0].action, 'report');
  assert.match(readText(path.join(engine.sandbox.home, 'projects/shop/config.sh')), /TEST_COMMAND="node --test"/);
});

test('fails a task after three rejected rounds and moves on to the next task', (t) => {
  const engine = createEngine(t);
  engine.startWithTasks();
  engine.reachImplement('P1', { testFile: 'test/pricing-promo.test.js', testContent: AC1_TEST });

  for (let round = 1; round <= 3; round += 1) {
    assert.equal(engine.task('P1').round, round);
    engine.commit({ [PRICING]: STUB.replace('total: subtotal', `total: subtotal - ${round}`) }, `sai lần ${round}`);
    engine.record('P1', 'implement', 'pass');
    assert.equal(engine.run(['gate', SPEC, '--task', 'P1']).json.result, 'fail');
  }

  assert.equal(engine.task('P1').state, 'failed');
  assert.match(engine.task('P1').lastFailure, /TEST_COMMAND không đạt/);
  assert.equal(engine.run(['next', SPEC]).json.task, 'P2');
});

test('rejects an implementation that edits a locked test', (t) => {
  const engine = createEngine(t);
  engine.startWithTasks();
  engine.reachImplement('P1', { testFile: 'test/pricing-promo.test.js', testContent: AC1_TEST });
  engine.commit({ 'test/pricing-promo.test.js': AC1_TEST.replace('450000', '500000'), [PRICING]: STUB }, 'sửa test cho pass');
  engine.record('P1', 'implement', 'pass');

  const gate = engine.run(['gate', SPEC, '--task', 'P1']);

  assert.equal(gate.json.result, 'fail');
  assert.match(gate.json.note, /Test đã khóa bị sửa: test\/pricing-promo\.test\.js/);
});

test('sends QC back when its tests already pass before any implementation', (t) => {
  const engine = createEngine(t);
  engine.startWithTasks();

  const lock = engine.reachImplement('P1', {
    testFile: 'test/pricing-promo.test.js',
    testContent: AC1_TEST.replace("priceOrder(items, 'GIAM50K')", 'priceOrder(items)').replace('450000', '500000'),
  });

  assert.equal(lock.json.result, 'fail');
  assert.match(lock.json.note, /Test PASS ngay trên code chưa implement/);
  assert.equal(engine.run(['next', SPEC]).json.step, 'tests');
});

test('does not count a test that fails on a missing module as red', (t) => {
  const engine = createEngine(t);
  engine.startWithTasks();

  const lock = engine.reachImplement('P1', {
    testFile: 'test/pricing-promo.test.js',
    testContent: AC1_TEST.replace('../src/pricing/index.js', '../src/pricing/khong-co.js'),
  });

  assert.equal(lock.json.result, 'fail');
  assert.match(lock.json.note, /lỗi biên dịch\/import, chưa tới assertion/);
});

test('blocks the spec instead of spending rounds when the test command cannot run', (t) => {
  const engine = createEngine(t, { configure: (config) => config.replace('TEST_COMMAND="node --test"', 'TEST_COMMAND="gf-lenh-khong-ton-tai"') });
  engine.startWithTasks();

  const lock = engine.reachImplement('P1', { testFile: 'test/pricing-promo.test.js', testContent: AC1_TEST });

  assert.equal(lock.json.result, 'blocked');
  assert.equal(engine.status().state, 'blocked');
  assert.equal(engine.task('P1').round, 0);
  const scan = engine.run(['scan']).json[0];
  assert.equal(scan.action, 'resume');
  assert.equal(scan.notify, true);
});

test('rejects changes under a forbidden path', (t) => {
  const engine = createEngine(t);
  engine.startWithTasks();
  engine.reachImplement('P1', { testFile: 'test/pricing-promo.test.js', testContent: AC1_TEST });
  engine.commit({ [PRICING]: DISCOUNT_ONLY, 'deploy/app.yml': 'replicas: 3\n' }, 'implement và sửa deploy');
  engine.record('P1', 'implement', 'pass');

  const gate = engine.run(['gate', SPEC, '--task', 'P1']);

  assert.equal(gate.json.result, 'fail');
  assert.match(gate.json.note, /Sửa đường dẫn bị cấm \(deploy\/\): deploy\/app\.yml/);
});

test('rejects changes to a module the spec declares read-only', (t) => {
  const engine = createEngine(t);
  engine.startWithTasks();
  engine.reachImplement('P1', { testFile: 'test/pricing-promo.test.js', testContent: AC1_TEST });
  engine.commit({ [PRICING]: DISCOUNT_ONLY, 'src/cart/index.js': '// thay đổi\nexport function cartTotal(items) { return 0; }\n' }, 'sửa cart');
  engine.record('P1', 'implement', 'pass');

  const gate = engine.run(['gate', SPEC, '--task', 'P1']);

  assert.equal(gate.json.result, 'fail');
  assert.match(gate.json.note, /check-scope không đạt[\s\S]*Module 'cart' khai báo 'Chỉ đọc' nhưng bị sửa/);
});

test('refuses to let an agent record a machine step by hand', (t) => {
  const engine = createEngine(t);
  engine.startWithTasks();
  engine.reachImplement('P1', { testFile: 'test/pricing-promo.test.js', testContent: AC1_TEST });
  engine.record('P1', 'implement', 'pass');

  const result = engine.record('P1', 'gate', 'pass');

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Bước 'gate' không ghi tay được/);
  assert.equal(engine.task('P1').step, 'gate');
});

test('lets QC change a locked test only with a spec reference and without losing assertions', (t) => {
  const engine = createEngine(t);
  engine.startWithTasks();
  engine.reachImplement('P1', { testFile: 'test/pricing-promo.test.js', testContent: AC1_TEST });
  engine.commit({ [PRICING]: DISCOUNT_ONLY }, 'implement');
  engine.record('P1', 'implement', 'pass');
  engine.run(['gate', SPEC, '--task', 'P1']);
  engine.record('P1', 'review', 'pass');

  const weaker = AC1_TEST.replace("  assert.equal(order.subtotal, 500000);\n", '');
  engine.commit({ 'test/pricing-promo.test.js': weaker }, 'QC bỏ bớt assertion');
  assert.match(engine.run(['relock', SPEC, '--task', 'P1', '--reason', 'đơn giản hóa']).json.note, /phải trích ID trong spec/);
  assert.match(engine.run(['relock', SPEC, '--task', 'P1', '--reason', 'AC-1 chỉ nói về total']).json.note, /Số test\/assertion giảm/);

  const stronger = AC1_TEST.replace("  assert.equal(order.subtotal, 500000);\n", "  assert.equal(order.subtotal, 500000);\n  assert.ok(order.total < order.subtotal);\n");
  engine.commit({ 'test/pricing-promo.test.js': stronger }, 'QC thêm assertion');
  assert.equal(engine.run(['relock', SPEC, '--task', 'P1', '--reason', 'AC-1: total phải nhỏ hơn subtotal']).json.result, 'pass');
  assert.equal(engine.task('P1').lock.assertions, 3);
});

test('pauses a run at the agent call cap and continues on the next run', (t) => {
  const engine = createEngine(t, { configure: (config) => config.replace('MAX_AGENT_CALLS_PER_RUN=150', 'MAX_AGENT_CALLS_PER_RUN=2') });
  engine.startWithTasks();
  engine.commit({ [PRICING]: STUB }, 'stub');
  engine.record('P1', 'stub', 'pass');

  assert.deepEqual(engine.run(['next', SPEC]).json.kind, 'pause');
  engine.run(['start', SPEC]);
  assert.equal(engine.run(['next', SPEC]).json.step, 'tests');
});

test('reports a finished spec to Telegram exactly once and never prints the token', async (t) => {
  const engine = createEngine(t);
  engine.startWithTasks({ tasks: [{ id: 'P1', title: 'Áp mã', acs: ['AC-1', 'AC-2'], policy: 'migration' }] });
  const received = [];
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      received.push({ url: request.url, body: JSON.parse(body) });
      response.end('{"ok":true}');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const env = {
    TELEGRAM_BOT_TOKEN: 'secret-token-123',
    TELEGRAM_CHAT_ID: '42',
    GF_TELEGRAM_API: `http://127.0.0.1:${server.address().port}`,
  };

  const first = await runWithoutBlocking(engine, ['notify', SPEC], env);
  const second = await runWithoutBlocking(engine, ['notify', SPEC], env);

  assert.equal(engine.status().state, 'failed');
  assert.equal(first.json.sent, true);
  assert.equal(second.json.sent, false);
  assert.equal(received.length, 1);
  assert.equal(received[0].url, '/botsecret-token-123/sendMessage');
  assert.equal(received[0].body.chat_id, '42');
  assert.match(received[0].body.text, /shop\/001-ap-ma-giam-gia: failed/);
  assert.ok(!first.stdout.includes('secret-token-123') && !first.stderr.includes('secret-token-123'));
  assert.match(readText(path.join(engine.sandbox.home, SPEC, 'runs/summary.md')), /BLOCKED_BY_POLICY/);
});

test('computes metrics across every spec in the gf home', (t) => {
  const engine = createEngine(t);
  engine.startWithTasks();
  rmSync(path.join(engine.sandbox.home, SPEC, 'pm-tasks.json'));

  const metrics = engine.run(['metrics']).json;

  assert.equal(metrics.specs, 1);
  assert.equal(metrics.tasks, 2);
  assert.equal(metrics.done, 0);
});
