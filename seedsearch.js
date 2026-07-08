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

// Distance (blocks, rounded) of a hit to the world origin the multi-seed
// scan is centered on.
/**
 * @param {{x: number, z: number}} hit
 * @returns {number}
 */
function originDist(hit) {
  return Math.round(Math.hypot(hit.x, hit.z));
}

// Candidate ordering: more places found first, then closest best place, then
// the seed string as a deterministic tie-break.
/**
 * @typedef {{seed: string, count: number, dist: number}} SeedCandidate
 * @param {SeedCandidate} a
 * @param {SeedCandidate} b
 * @returns {number}
 */
function compareCandidates(a, b) {
  return (b.count - a.count) || (a.dist - b.dist) || a.seed.localeCompare(b.seed);
}

// Sorted insert with a size cap; returns a new list (input untouched). A
// candidate for an already-listed seed replaces it (a resumed run may
// re-scan a few seeds around the interruption point).
/**
 * @template {SeedCandidate} T
 * @param {T[]} list current candidates, already sorted
 * @param {T} cand new candidate
 * @param {number} [cap] list cap
 * @returns {T[]}
 */
function insertCandidate(list, cand, cap = SEED_SEARCH_MAX_FOUND) {
  return [...list.filter((c) => c.seed !== cand.seed), cand].sort(compareCandidates).slice(0, cap);
}

// ---- resumable runs ----
// Snapshot of an interrupted multi-seed search: enough to pick it up after a
// cancel or a page reload. Batches not yet completed (queued or in flight
// when the run stopped) are re-scanned on resume; insertCandidate dedups.
/**
 * @typedef {{v: number, mode: string, start: string, total: number,
 *            radius: number, step: number, mc: number, large: boolean,
 *            dim: number, y: number, crit: object, scanned: number,
 *            batches: Array<{offset: number, count: number}>,
 *            candidates: Array<{seed: string, hit: {x: number, z: number},
 *                               count: number, dist: number}>}} SeedRun
 */

/** @param {SeedRun} run @returns {string} JSON payload for localStorage */
function serializeSeedRun(run) {
  return JSON.stringify({ ...run, v: 1 });
}

/** @param {any} v @returns {number|null} */
function seedRunInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

// localStorage contents are outside the app's control: reject anything that
// is not a complete, well-formed interrupted run.
/**
 * @param {string|null} json raw localStorage payload
 * @returns {SeedRun|null} the run, or null when absent/malformed/finished
 */
function parseSeedRun(json) {
  let r;
  try { r = JSON.parse(String(json)); } catch { return null; }
  if (!r || typeof r !== 'object' || r.v !== 1) return null;
  if (r.mode !== 'seq' && r.mode !== 'random') return null;
  if (typeof r.start !== 'string' && typeof r.start !== 'number') return null;
  if (typeof r.crit !== 'object' || r.crit === null) return null;
  const total = seedRunInt(r.total), radius = seedRunInt(r.radius), step = seedRunInt(r.step);
  const mc = seedRunInt(r.mc), dim = seedRunInt(r.dim), y = seedRunInt(r.y), scanned = seedRunInt(r.scanned);
  if ([total, radius, step, mc, dim, y, scanned].includes(null)) return null;
  if (total < 1 || total > SEED_SEARCH_MAX_TOTAL || scanned < 0 || ![0, -1, 1].includes(dim)) return null;
  const batches = (Array.isArray(r.batches) ? r.batches : [])
    .map((/** @type {any} */ b) => ({ offset: seedRunInt(b?.offset), count: seedRunInt(b?.count) }))
    .filter((/** @type {{offset: number|null, count: number|null}} */ b) => b.offset !== null && b.count !== null && b.offset >= 0 && b.count > 0);
  if (!batches.length) return null;   // nothing left to do: not resumable
  const candidates = (Array.isArray(r.candidates) ? r.candidates : [])
    .map((/** @type {any} */ c) => {
      const x = seedRunInt(c?.hit?.x), z = seedRunInt(c?.hit?.z);
      const count = seedRunInt(c?.count), dist = seedRunInt(c?.dist);
      if (typeof c?.seed !== 'string' || x === null || z === null || count === null || dist === null) return null;
      return { seed: c.seed, hit: { x, z }, count, dist };
    })
    .filter((/** @type {any} */ c) => c !== null)
    .slice(0, SEED_SEARCH_MAX_FOUND);
  return {
    v: 1, mode: r.mode, start: String(r.start), total, radius, step,
    mc, large: !!r.large, dim, y, crit: r.crit, scanned,
    batches: /** @type {Array<{offset: number, count: number}>} */ (batches), candidates
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SEED_SEARCH_MAX_TOTAL, SEED_SEARCH_MAX_FOUND,
    sequentialSeeds, randomSeeds, planBatches,
    originDist, compareCandidates, insertCandidate,
    serializeSeedRun, parseSeedRun
  };
}
