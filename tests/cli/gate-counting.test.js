import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { countTestsAndAssertions } from '../../lib/engine/gate.js';

function countIn(t, fileName, content) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'gf-count-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(path.join(dir, fileName), content);
  return countTestsAndAssertions(dir, [fileName]);
}

test('counts node:test cases and assertions without counting the import line', (t) => {
  const counts = countIn(
    t,
    'a.test.js',
    "import assert from 'node:assert/strict';\nimport test from 'node:test';\ntest('a', () => {\n  assert.equal(1, 1);\n  assert.ok(true);\n});\n",
  );

  assert.deepEqual(counts, { tests: 1, assertions: 2 });
});

test('counts jest style it() and expect()', (t) => {
  const counts = countIn(t, 'b.spec.ts', "it('a', () => { expect(1).toBe(1); });\nit('b', () => { expect(2).toBe(2); });\n");

  assert.deepEqual(counts, { tests: 2, assertions: 2 });
});

test('counts pytest functions and bare assert statements', (t) => {
  const counts = countIn(t, 'test_c.py', 'def test_a():\n    assert 1 == 1\n\ndef test_b():\n    assert total(2) == 2\n');

  assert.deepEqual(counts, { tests: 2, assertions: 2 });
});

test('ignores files that no longer exist', () => {
  assert.deepEqual(countTestsAndAssertions(os.tmpdir(), ['khong-co-file-nay.test.js']), { tests: 0, assertions: 0 });
});
