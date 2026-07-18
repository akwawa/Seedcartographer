// rarebiomes.js — pure logic for the one-click "nearest rare biome" search
// (#252). The worker scans growing square rings around the view center and
// stops as soon as no unexplored cell can beat the best hit; this module
// holds the biome list, the ring geometry and the nearest-cell scan so the
// whole strategy is unit-testable without the WASM engine.

// Rare Overworld biomes offered as one-click buttons. Ids are the cubiomes
// enum values (cubiomes/biomes.h); names are the engine's technical names,
// so biomeLabel() translates them like any dropdown entry.
/** @type {ReadonlyArray<{id: number, name: string}>} */
export const RARE_BIOMES = [
  { id: 14, name: 'mushroom_fields' },
  { id: 37, name: 'badlands' },
  { id: 165, name: 'eroded_badlands' },
  { id: 185, name: 'cherry_grove' },
  { id: 140, name: 'ice_spikes' },
  { id: 21, name: 'jungle' },
  { id: 168, name: 'bamboo_jungle' },
  { id: 184, name: 'mangrove_swamp' }
];

// ring thickness and the automatic radius bound, in blocks
export const RARE_RING_BLOCKS = 1024;
export const RARE_MAX_RADIUS = 10240;

/**
 * Number of rings needed to cover `maxRadius` with rings of `ringBlocks`.
 * @param {number} [maxRadius] search bound in blocks
 * @param {number} [ringBlocks] ring thickness in blocks
 * @returns {number} ring count (at least 1)
 */
export function rareRingCount(maxRadius = RARE_MAX_RADIUS, ringBlocks = RARE_RING_BLOCKS) {
  return Math.max(1, Math.ceil(maxRadius / ringBlocks));
}

/**
 * Cell rectangles of square ring `k` (thickness `half` cells) around the
 * center cell. Ring 0 is the full central square; outer rings are 4 bands
 * (top, bottom, left, right) that tile the frame with no overlap, so the
 * engine never regenerates the interior already scanned.
 * @param {number} k ring index (0-based)
 * @param {number} half ring thickness in cells
 * @returns {Array<{ci0: number, cj0: number, cols: number, rows: number}>}
 *   rects in cells relative to the center cell (ci0/cj0 = NW corner)
 */
export function ringRects(k, half) {
  const outer = (k + 1) * half;
  if (k === 0) {
    return [{ ci0: -outer, cj0: -outer, cols: 2 * outer + 1, rows: 2 * outer + 1 }];
  }
  const inner = k * half;
  const w = 2 * outer + 1;
  const band = outer - inner;
  return [
    { ci0: -outer, cj0: -outer, cols: w, rows: band },
    { ci0: -outer, cj0: inner + 1, cols: w, rows: band },
    { ci0: -outer, cj0: -inner, cols: band, rows: 2 * inner + 1 },
    { ci0: inner + 1, cj0: -inner, cols: band, rows: 2 * inner + 1 }
  ];
}

/**
 * Scan one generated rect for the target biome and keep the cell closest to
 * the center. Distances are in cells (squared), relative to the center cell.
 * @param {Int32Array|number[]} grid biome ids, row-major, cols×rows
 * @param {number} cols rect width in cells
 * @param {number} rows rect height in cells
 * @param {number} ci0 rect NW corner, cells relative to the center
 * @param {number} cj0 rect NW corner, cells relative to the center
 * @param {number} biomeId target biome id
 * @param {{ci: number, cj: number, d2: number}|null} best best hit so far
 * @returns {{ci: number, cj: number, d2: number}|null} updated best hit
 */
export function nearestMatch(grid, cols, rows, ci0, cj0, biomeId, best) {
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (grid[j * cols + i] !== biomeId) continue;
      const ci = ci0 + i, cj = cj0 + j;
      const d2 = ci * ci + cj * cj;
      if (!best || d2 < best.d2) best = { ci, cj, d2 };
    }
  }
  return best;
}

/**
 * Can the ring scan stop after ring `k`? Every unexplored cell has Chebyshev
 * distance > (k+1)*half cells, hence Euclidean distance > (k+1)*half too: a
 * best hit within that radius can never be beaten by a later ring.
 * @param {{d2: number}|null} best best hit so far
 * @param {number} k index of the ring just scanned
 * @param {number} half ring thickness in cells
 * @returns {boolean} true when the best hit is provably the nearest
 */
export function rareSearchDone(best, k, half) {
  const bound = (k + 1) * half;
  return best !== null && best.d2 <= bound * bound;
}

/**
 * Convert a best hit (cells relative to the center cell) to world blocks.
 * @param {{ci: number, cj: number}} best hit cell
 * @param {number} ccx center cell x (blocks / SC)
 * @param {number} ccz center cell z (blocks / SC)
 * @param {number} SC blocks per cell
 * @returns {{x: number, z: number}} world block coordinates
 */
export function rareHit(best, ccx, ccz, SC) {
  return { x: (ccx + best.ci) * SC, z: (ccz + best.cj) * SC };
}
