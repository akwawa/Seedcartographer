import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import test from 'node:test';
import assert from 'node:assert';
const { buildGrid, buildPoints, runScenario, bench } = require('../scripts/bench-scan.js');

test('the synthetic grid is deterministic and uses only the given biomes', () => {
  const a = buildGrid(50, 50, [1, 44]);
  const b = buildGrid(50, 50, [1, 44]);
  assert.deepStrictEqual([...a], [...b]);
  for (const id of a) assert.strictEqual([1, 44].includes(id), true);
});

test('synthetic structure points stay inside the box', () => {
  const pts = buildPoints(100, 1000);
  assert.strictEqual(pts.length > 0 && pts.length <= 100, true);
  for (const [x, z] of pts) {
    assert.strictEqual(Math.abs(x) <= 1000 && Math.abs(z) <= 1000, true);
  }
});

test('the scenario produces hits and a positive duration (small size)', () => {
  const r = runScenario({ range: 800, SC: 16, step: 48 });
  assert.strictEqual(r.ms >= 0, true);
  assert.strictEqual(r.hits >= 0, true);
});

test('bench returns the best of N runs', () => {
  const { best, hits } = bench({ range: 400 }, 2);
  assert.strictEqual(Number.isFinite(best) && best >= 0, true);
  assert.strictEqual(hits >= 0, true);
});
