// seedsearch.js — pure planning logic for the multi-seed search: candidate
// seed generation (sequential range or random) and batch distribution over a
// worker pool. Shared between app.js (script tag) and the Node test suite.
'use strict';

// Browser: seed.js is loaded first (script tag); Node tests: require directly.
const toSeed = /** @type {any} */ (globalThis).seedToBigInt || require('./seed.js').seedToBigInt;

const SEED_SEARCH_MAX_TOTAL = 100000;   // seeds tested per run, sanity cap
const SEED_SEARCH_MAX_FOUND = 50;       // candidate list cap

// `count` consecutive seeds starting at `start + offset` (64-bit wraparound).
// A textual start seed is hashed exactly like Minecraft would.
/**
 * @param {string|number} start seed input as typed by the user
 * @param {number} offset index of the first seed of this batch
 * @param {number} count how many seeds
 * @returns {string[]} decimal signed 64-bit seed strings
 */
function sequentialSeeds(start, offset, count) {
  const base = toSeed(start);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(String(BigInt.asIntN(64, base + BigInt(offset + i))));
  }
  return out;
}

// `count` random 64-bit seeds drawn from `rand` (callback in [0,1)).
/**
 * @param {number} count how many seeds
 * @param {() => number} rand uniform [0,1) source
 * @returns {string[]} decimal signed 64-bit seed strings
 */
function randomSeeds(count, rand) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const hi = BigInt(Math.floor(rand() * 0x100000000));
    const lo = BigInt(Math.floor(rand() * 0x100000000));
    out.push(String(BigInt.asIntN(64, (hi << 32n) | lo)));
  }
  return out;
}

// Split `total` seeds into batches of at most `batchSize` for the pool.
/**
 * @param {number} total seeds to test (clamped to the sanity cap)
 * @param {number} batchSize seeds per worker message
 * @returns {Array<{offset: number, count: number}>}
 */
function planBatches(total, batchSize) {
  const t = Math.max(0, Math.min(SEED_SEARCH_MAX_TOTAL, Math.floor(total)));
  const size = Math.max(1, Math.floor(batchSize));
  const out = [];
  for (let offset = 0; offset < t; offset += size) {
    out.push({ offset, count: Math.min(size, t - offset) });
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SEED_SEARCH_MAX_TOTAL, SEED_SEARCH_MAX_FOUND,
    sequentialSeeds, randomSeeds, planBatches
  };
}
