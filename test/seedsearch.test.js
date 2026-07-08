'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
  SEED_SEARCH_MAX_TOTAL, sequentialSeeds, randomSeeds, planBatches,
  originDist, compareCandidates, insertCandidate, serializeSeedRun, parseSeedRun
} = require('../seedsearch.js');

test('sequentialSeeds counts from the start seed with 64-bit wraparound', () => {
  assert.deepStrictEqual(sequentialSeeds('141', 0, 3), ['141', '142', '143']);
  assert.deepStrictEqual(sequentialSeeds('141', 10, 2), ['151', '152']);
  // wraps at the signed 64-bit boundary
  assert.deepStrictEqual(sequentialSeeds('9223372036854775807', 0, 2),
    ['9223372036854775807', '-9223372036854775808']);
  // a text seed starts from its Java hash, like Minecraft
  assert.strictEqual(sequentialSeeds('herobrine', 0, 1)[0], String(require('../seed.js').seedToBigInt('herobrine')));
});

test('randomSeeds builds signed 64-bit seeds from the rand callback', () => {
  const seq = [0, 0, 0.5, 0.5, 0.9999999999, 0.9999999999];
  let i = 0;
  const seeds = randomSeeds(3, () => seq[i++]);
  assert.strictEqual(seeds[0], '0');
  // hi = 2^31, lo = 2^31 -> sign bit set: negative seed
  assert.ok(BigInt(seeds[1]) < 0n);
  assert.strictEqual(seeds.length, 3);
  for (const s of seeds) {
    const v = BigInt(s);
    assert.ok(v >= -(2n ** 63n) && v < 2n ** 63n);
  }
});

test('planBatches splits the total and clamps to the sanity cap', () => {
  assert.deepStrictEqual(planBatches(20, 8),
    [{ offset: 0, count: 8 }, { offset: 8, count: 8 }, { offset: 16, count: 4 }]);
  assert.deepStrictEqual(planBatches(0, 8), []);
  const capped = planBatches(1e9, 1000);
  assert.strictEqual(capped.reduce((s, b) => s + b.count, 0), SEED_SEARCH_MAX_TOTAL);
  // batch size floor
  assert.deepStrictEqual(planBatches(2, 0.5), [{ offset: 0, count: 1 }, { offset: 1, count: 1 }]);
});

test('originDist is the rounded euclidean distance to the origin', () => {
  assert.strictEqual(originDist({ x: 3, z: 4 }), 5);
  assert.strictEqual(originDist({ x: 0, z: 0 }), 0);
  assert.strictEqual(originDist({ x: -300, z: 400 }), 500);
});

test('candidates rank by place count, then closest best place', () => {
  const a = { seed: 'a', count: 3, dist: 900 };
  const b = { seed: 'b', count: 1, dist: 10 };
  const c = { seed: 'c', count: 3, dist: 100 };
  assert.ok(compareCandidates(c, a) < 0);   // same count, closer wins
  assert.ok(compareCandidates(a, b) < 0);   // more places wins over distance
  // deterministic tie-break on the seed string
  assert.ok(compareCandidates({ seed: '1', count: 1, dist: 5 }, { seed: '2', count: 1, dist: 5 }) < 0);
});

test('insertCandidate keeps the list sorted and capped', () => {
  let list = [];
  list = insertCandidate(list, { seed: 'far', count: 1, dist: 1000 });
  list = insertCandidate(list, { seed: 'best', count: 2, dist: 500 });
  list = insertCandidate(list, { seed: 'near', count: 1, dist: 50 });
  assert.deepStrictEqual(list.map((c) => c.seed), ['best', 'near', 'far']);
  // the cap drops the worst-ranked candidate
  const capped = insertCandidate(list, { seed: 'mid', count: 1, dist: 200 }, 3);
  assert.deepStrictEqual(capped.map((c) => c.seed), ['best', 'near', 'mid']);
});

test('insertCandidate replaces an already-listed seed instead of duplicating', () => {
  const a = { seed: '10', count: 1, dist: 500 };
  const list = insertCandidate([], a);
  const updated = insertCandidate(list, { seed: '10', count: 3, dist: 200 });
  assert.strictEqual(updated.length, 1);
  assert.strictEqual(updated[0].count, 3);
});

test('a seed run round-trips through serialize/parse', () => {
  const run = {
    v: 1, mode: 'seq', start: '141', total: 2000, radius: 1500, step: 32,
    mc: 22, large: false, dim: 0, y: 60, crit: { mb: [5] }, scanned: 512,
    batches: [{ offset: 512, count: 8 }, { offset: 520, count: 8 }],
    candidates: [{ seed: '150', hit: { x: 10, z: -20 }, count: 2, dist: 22 }]
  };
  assert.deepStrictEqual(parseSeedRun(serializeSeedRun(run)), run);
});

test('parseSeedRun rejects malformed or finished runs', () => {
  const base = {
    v: 1, mode: 'random', start: '0', total: 100, radius: 1500, step: 32,
    mc: 22, large: true, dim: -1, y: 60, crit: {}, scanned: 10,
    batches: [{ offset: 10, count: 8 }], candidates: []
  };
  assert.notStrictEqual(parseSeedRun(JSON.stringify(base)), null);
  assert.strictEqual(parseSeedRun(null), null);
  assert.strictEqual(parseSeedRun('junk'), null);
  assert.strictEqual(parseSeedRun('[1]'), null);
  assert.strictEqual(parseSeedRun(JSON.stringify({ ...base, v: 2 })), null);
  assert.strictEqual(parseSeedRun(JSON.stringify({ ...base, mode: 'other' })), null);
  assert.strictEqual(parseSeedRun(JSON.stringify({ ...base, start: {} })), null);
  assert.strictEqual(parseSeedRun(JSON.stringify({ ...base, crit: 'x' })), null);
  assert.strictEqual(parseSeedRun(JSON.stringify({ ...base, total: 'x' })), null);
  assert.strictEqual(parseSeedRun(JSON.stringify({ ...base, total: 0 })), null);
  assert.strictEqual(parseSeedRun(JSON.stringify({ ...base, total: 1e9 })), null);
  assert.strictEqual(parseSeedRun(JSON.stringify({ ...base, scanned: -1 })), null);
  assert.strictEqual(parseSeedRun(JSON.stringify({ ...base, dim: 5 })), null);
  // an empty batch queue means the run finished: nothing to resume
  assert.strictEqual(parseSeedRun(JSON.stringify({ ...base, batches: [] })), null);
  assert.strictEqual(parseSeedRun(JSON.stringify({ ...base, batches: [{ offset: -1, count: 8 }] })), null);
  assert.strictEqual(parseSeedRun(JSON.stringify({ ...base, batches: [{ offset: 0, count: 0 }] })), null);
  assert.strictEqual(parseSeedRun(JSON.stringify({ ...base, batches: 'x' })), null);
});

test('parseSeedRun scrubs candidates and coerces a numeric start seed', () => {
  const run = parseSeedRun(JSON.stringify({
    v: 1, mode: 'seq', start: 141, total: 100, radius: 1500, step: 32,
    mc: 22, large: 0, dim: 0, y: 60, crit: {}, scanned: 10,
    batches: [{ offset: 10, count: 8 }, 'junk', { offset: 'x', count: 8 }],
    candidates: [
      { seed: '150', hit: { x: 1, z: 2 }, count: 1, dist: 2 },
      { seed: 150, hit: { x: 1, z: 2 }, count: 1, dist: 2 },   // non-string seed
      { seed: '151', hit: { x: 'a', z: 2 }, count: 1, dist: 2 },
      { seed: '152', hit: { x: 1, z: 'b' }, count: 1, dist: 2 },
      { seed: '153', hit: { x: 1, z: 2 }, count: 'x', dist: 2 },
      { seed: '154', hit: { x: 1, z: 2 }, count: 1, dist: {} },
      { seed: '155', count: 1, dist: 2 },
      'junk'
    ]
  }));
  assert.strictEqual(run.start, '141');
  assert.strictEqual(run.large, false);
  assert.deepStrictEqual(run.batches, [{ offset: 10, count: 8 }]);
  assert.deepStrictEqual(run.candidates, [{ seed: '150', hit: { x: 1, z: 2 }, count: 1, dist: 2 }]);
  // a run whose candidates key is not an array still parses
  assert.notStrictEqual(parseSeedRun(JSON.stringify({
    v: 1, mode: 'seq', start: '1', total: 100, radius: 1, step: 1, mc: 22,
    large: false, dim: 0, y: 60, crit: {}, scanned: 0,
    batches: [{ offset: 0, count: 8 }], candidates: 'x'
  })), null);
});
