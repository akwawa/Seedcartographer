// composition.js — pure logic for the biome composition panel (#286).
// Reuses the disc-sampling idea of the percentage clauses (#142): counting
// the cells of a regular grid inside the disc gives an unbiased estimate of
// each biome's share of the area around the clicked point.

/** @typedef {{id: number, count: number, pct: number}} CompositionEntry */

/**
 * Count the biome ids of the grid cells whose center lies inside the disc of
 * `dist` blocks around cell (ci, cj). Cells are `sc` blocks wide; cells
 * falling outside the grid are skipped.
 * @param {Int32Array|number[]} grid row-major biome ids (rows × cols)
 * @param {number} cols grid width in cells
 * @param {number} rows grid height in cells
 * @param {number} ci center cell column
 * @param {number} cj center cell row
 * @param {number} sc cell size in blocks
 * @param {number} dist disc radius in blocks
 * @returns {Map<number, number>} biome id -> sampled cell count
 */
export function discCounts(grid, cols, rows, ci, cj, sc, dist) {
  const cells = Math.floor(dist / sc);
  const dist2 = dist * dist;
  const counts = new Map();
  for (let dj = -cells; dj <= cells; dj++) {
    const nj = cj + dj;
    if (nj < 0 || nj >= rows) continue;
    for (let di = -cells; di <= cells; di++) {
      const ni = ci + di;
      if (ni < 0 || ni >= cols) continue;
      if ((di * sc) * (di * sc) + (dj * sc) * (dj * sc) > dist2) continue;
      const id = grid[nj * cols + ni];
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  return counts;
}

/**
 * Turn raw biome counts into a list sorted by decreasing share, with
 * one-decimal percentages that sum to exactly 100 (largest-remainder
 * rounding on tenths). An empty count map yields an empty list.
 * @param {Map<number, number>} counts biome id -> cell count
 * @returns {CompositionEntry[]} sorted by pct desc, then count desc, then id
 */
export function compositionShares(counts) {
  const entries = [...counts.entries()].map(([id, count]) => ({ id, count }));
  const total = entries.reduce((s, e) => s + e.count, 0);
  if (total === 0) return [];
  // tenths of a percent: floor, then hand the leftover tenths to the
  // largest remainders so the displayed percentages sum to 100.0
  const scaled = entries.map((e) => (e.count * 1000) / total);
  const tenths = scaled.map(Math.floor);
  let left = 1000 - tenths.reduce((s, v) => s + v, 0);
  const order = scaled
    .map((v, i) => ({ i, frac: v - tenths[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    tenths[i]++;
    left--;
  }
  return entries
    .map((e, i) => ({ id: e.id, count: e.count, pct: tenths[i] / 10 }))
    .sort((a, b) => b.pct - a.pct || b.count - a.count || a.id - b.id);
}
