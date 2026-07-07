'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
  SEED_SEARCH_MAX_TOTAL, sequentialSeeds, randomSeeds, planBatches
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
