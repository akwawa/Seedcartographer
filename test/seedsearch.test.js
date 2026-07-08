'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
  SEED_SEARCH_MAX_TOTAL, sequentialSeeds, randomSeeds, planBatches,
  originDist, compareCandidates, insertCandidate
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
