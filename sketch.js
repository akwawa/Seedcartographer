// sketch.js — geographic-layout sketch search (#326): the user draws the
// wanted biome-family layout on a 5×5 mini-grid; a candidate spot matches
// when the dominant biome family around it reproduces the sketch. Pure ES
// module shared between worker.js (via search.js), app.js and the Node
// test suite.

import { WATER_BIOMES } from './shapes.js';

export const SKETCH_SIZE = 5;
// World scale of the sketch: each of the 5×5 cells covers a square zone of
// 480×480 blocks, so the whole sketch spans 2400 blocks (radius ~1200
// around the candidate spot) — the scale where biome-family layouts (a
// coastline on one side, mountains on the other…) are actually visible on
// the map, and a comfortable fit for the default search radii.
export const SKETCH_CELL_BLOCKS = 480;
// grid padding needed around a candidate so all 25 zones can be sampled
export const SKETCH_PAD_BLOCKS = SKETCH_CELL_BLOCKS * SKETCH_SIZE / 2;

// Biome families offered by the sketch palette, in the cycling order of the
// UI cells. Every Overworld biome id maps to at most one family; ids outside
// the table (mushroom fields, caves, Nether/End…) belong to no family and
// never dominate a zone.
export const SKETCH_FAMILIES = Object.freeze(
  ['ocean', 'plains', 'forest', 'desert', 'mountain', 'snow', 'jungle', 'swamp']);

// display colors of the palette (roughly the map colors of each family)
export const SKETCH_FAMILY_COLORS = Object.freeze({
  ocean: '#3b5dd9', plains: '#8db360', forest: '#1f7d35', desert: '#dfce58',
  mountain: '#888888', snow: '#dfe8ee', jungle: '#12a03c', swamp: '#5f7a3a'
});

// cubiomes biome id -> family (cubiomes/biomes.h enum values). Water ids
// come from shapes.js so the two features can never disagree on what floats.
const FAMILY_IDS = {
  plains: [1, 16, 35, 36, 54, 129, 163, 164, 177],
  forest: [4, 5, 18, 19, 27, 28, 29, 32, 33, 52, 132, 133, 155, 156, 157, 160, 161, 185, 186],
  desert: [2, 17, 37, 38, 39, 130, 165, 166, 167],
  mountain: [3, 20, 25, 34, 131, 162, 180, 182],
  snow: [12, 13, 26, 30, 31, 140, 158, 178, 179, 181],
  jungle: [21, 22, 23, 53, 149, 151, 168, 169],
  swamp: [6, 134, 184]
};
const BIOME_FAMILY = new Map();
for (const id of WATER_BIOMES) BIOME_FAMILY.set(id, 'ocean');
for (const [fam, ids] of Object.entries(FAMILY_IDS)) {
  for (const id of ids) BIOME_FAMILY.set(id, fam);
}

/**
 * @param {number} id cubiomes biome id
 * @returns {string|null} family key, or null when the biome has no family
 */
export function biomeFamily(id) {
  return BIOME_FAMILY.get(id) ?? null;
}

// ---- sketch grid transforms (25-element row-major arrays) ----
/**
 * @param {string[]} cells 25 family keys ('' = indifferent)
 * @returns {string[]} the sketch rotated 90° clockwise
 */
export function rotateSketch(cells) {
  const n = SKETCH_SIZE;
  const out = new Array(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) out[r * n + c] = cells[(n - 1 - c) * n + r];
  }
  return out;
}
/**
 * @param {string[]} cells 25 family keys ('' = indifferent)
 * @returns {string[]} the sketch mirrored left-right
 */
export function mirrorSketch(cells) {
  const n = SKETCH_SIZE;
  const out = new Array(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) out[r * n + c] = cells[r * n + (n - 1 - c)];
  }
  return out;
}
/**
 * All orientations of the sketch to test: the sketch itself, its 90°
 * rotations when `rot`, and the mirror of each kept orientation when `mir`.
 * @param {string[]} cells @param {boolean} rot @param {boolean} mir
 * @returns {string[][]} 1, 2, 4 or 8 sketch grids
 */
export function sketchVariants(cells, rot, mir) {
  const out = [cells.slice()];
  if (rot) {
    for (let k = 0; k < 3; k++) out.push(rotateSketch(out.at(-1)));
  }
  if (mir) {
    for (const v of [...out]) out.push(mirrorSketch(v));
  }
  return out;
}

// ---- scoring ----
/**
 * Proportion of the sketch's constrained cells that the sampled layout
 * reproduces. A sketch with no constrained cell scores 0 (it can anchor
 * nothing).
 * @param {Array<string|null>} actual 25 dominant families (null = none)
 * @param {string[]} wanted 25 family keys ('' = indifferent)
 * @returns {number} score in [0, 1]
 */
export function sketchScore(actual, wanted) {
  let match = 0, total = 0;
  for (let i = 0; i < wanted.length; i++) {
    if (!wanted[i]) continue;
    total++;
    if (actual[i] === wanted[i]) match++;
  }
  return total ? match / total : 0;
}
/**
 * Best score over the enabled orientations of the sketch.
 * @param {Array<string|null>} actual 25 dominant families (null = none)
 * @param {string[]} wanted 25 family keys ('' = indifferent)
 * @param {{rot?: boolean, mir?: boolean}} [opts] allow rotations / mirrors
 * @returns {number} best score in [0, 1]
 */
export function bestSketchScore(actual, wanted, opts) {
  let best = 0;
  for (const v of sketchVariants(wanted, !!opts?.rot, !!opts?.mir)) {
    const s = sketchScore(actual, v);
    if (s > best) best = s;
  }
  return best;
}

// ---- share-link / preset sanitization ----
// The sketch travels in the share hash and the custom presets as
// {g: string[25], r: 0|1, m: 0|1, p: 1..100}; values are untrusted.
/**
 * @param {any} raw untrusted sketch payload
 * @returns {{g: string[], r: number, m: number, p: number}|null} clean
 *          sketch, or null when empty/malformed
 */
export function sanitizeSketch(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.g)) return null;
  const g = [];
  for (let i = 0; i < SKETCH_SIZE * SKETCH_SIZE; i++) {
    const f = raw.g[i];
    g.push(SKETCH_FAMILIES.includes(f) ? f : '');
  }
  if (!g.some(Boolean)) return null;
  const p = Number.parseInt(raw.p, 10);
  return {
    g,
    r: raw.r ? 1 : 0,
    m: raw.m ? 1 : 0,
    p: Number.isFinite(p) ? Math.min(100, Math.max(1, p)) : 60
  };
}

// ---- per-cell evaluation on a biome grid (used by search.js) ----
// Prepared once per scan: zone size in grid cells, sampling sub-step (a
// regular subsample of each 480-block zone — ~16-25 probes per zone — is
// plenty to elect a dominant family) and the orientation variants.
/**
 * @param {{cells: string[], rot?: boolean, mir?: boolean, pct: number}} sk
 * @param {number} SC blocks per grid cell
 * @returns {{cellCells: number, sub: number, variants: string[][],
 *            minScore: number}|null} prepared sketch, or null when malformed
 */
export function prepSketch(sk, SC) {
  if (!sk || !Array.isArray(sk.cells) || sk.cells.length !== SKETCH_SIZE * SKETCH_SIZE) return null;
  if (!sk.cells.every((f) => f === '' || SKETCH_FAMILIES.includes(f))) return null;
  if (!sk.cells.some(Boolean)) return null;
  if (!Number.isFinite(sk.pct) || sk.pct < 1 || sk.pct > 100) return null;
  const cellCells = Math.max(1, Math.round(SKETCH_CELL_BLOCKS / SC));
  return {
    cellCells,
    sub: Math.max(1, Math.floor(cellCells / 4)),
    variants: sketchVariants(sk.cells, !!sk.rot, !!sk.mir),
    minScore: sk.pct / 100
  };
}

// dominant family of one zone: most frequent family over the subsample;
// out-of-grid probes are skipped, a zone with no family probe has none
/** @param {{grid: Int32Array|number[], cols: number, rows: number}} g @param {number} i0 @param {number} j0 zone NW cell @param {number} cellCells @param {number} sub @returns {string|null} */
function zoneDominant(g, i0, j0, cellCells, sub) {
  const counts = new Map();
  for (let dj = 0; dj < cellCells; dj += sub) {
    const nj = j0 + dj;
    if (nj < 0 || nj >= g.rows) continue;
    for (let di = 0; di < cellCells; di += sub) {
      const ni = i0 + di;
      if (ni < 0 || ni >= g.cols) continue;
      const f = biomeFamily(g.grid[nj * g.cols + ni]);
      if (f) counts.set(f, (counts.get(f) || 0) + 1);
    }
  }
  let best = null, bn = 0;
  for (const [f, n] of counts) {
    if (n > bn) { best = f; bn = n; }
  }
  return best;
}

/**
 * Dominant families of the 25 zones centered on grid cell (ci, cj).
 * @param {{grid: Int32Array|number[], cols: number, rows: number}} g
 * @param {number} ci @param {number} cj center cell
 * @param {number} cellCells zone side in grid cells
 * @param {number} sub sampling sub-step in grid cells
 * @returns {Array<string|null>} 25 dominant families, row-major
 */
export function dominantFamilies(g, ci, cj, cellCells, sub) {
  const n = SKETCH_SIZE;
  const half = Math.floor(cellCells * n / 2);
  const out = new Array(n * n);
  for (let v = 0; v < n; v++) {
    for (let u = 0; u < n; u++) {
      out[v * n + u] = zoneDominant(g, ci - half + u * cellCells, cj - half + v * cellCells, cellCells, sub);
    }
  }
  return out;
}

/**
 * Does the sketch match at (ci, cj)? The dominant families are sampled once,
 * then every enabled orientation is scored against them.
 * @param {any} sk prepared sketch (prepSketch)
 * @param {{grid: Int32Array|number[], cols: number, rows: number}} g
 * @param {number} ci @param {number} cj candidate cell
 * @returns {boolean}
 */
export function sketchPass(sk, g, ci, cj) {
  const actual = dominantFamilies(g, ci, cj, sk.cellCells, sk.sub);
  return sk.variants.some((/** @type {string[]} */ w) => sketchScore(actual, w) >= sk.minScore);
}
