// tilegrid.js — world-aligned fixed-size tile grid for the progressive map
// render. Pure-math ES module shared between app.js, worker.js and the
// Node test suite.
//
// A tile is TILE_CELLS × TILE_CELLS engine cells of `scale` blocks each, its
// NW corner aligned on a multiple of the tile span (TILE_CELLS * scale)
// world-wide: the same world region always maps to the same tile key, which
// is what makes the LRU cache reusable across pans.

const TILE_CELLS = 256;          // cells per tile side
const TILE_GRID_CACHE_MAX = 96;  // small tiles kept in the LRU (~25 MB)
const TILE_PAINT_MAX = 48;       // tiles painted per frame (overdraw budget)

// Engine cell scale for a zoom level — must mirror the worker's choice so
// the app can address the tiles the worker will produce.
/**
 * @param {number} bpp blocks per screen pixel
 * @returns {number} blocks per engine cell (4, 16, 64 or 256)
 */
function renderScaleFor(bpp) {
  const S = [4, 16, 64, 256];
  for (const s of S) if (s >= bpp) return s;
  return 256;
}

// World-aligned tiles covering the viewport, ordered center-first so the
// checkerboard fills from where the user is looking.
/**
 * @param {{cx: number, cz: number, bpp: number}} view map view
 * @param {number} w viewport width in screen pixels
 * @param {number} h viewport height in screen pixels
 * @param {number} scale blocks per engine cell
 * @returns {Array<{originX: number, originZ: number}>} tile NW corners (blocks)
 */
function tilesForView(view, w, h, scale) {
  const span = TILE_CELLS * scale;
  const x0 = Math.floor((view.cx - w * view.bpp / 2) / span) * span;
  const z0 = Math.floor((view.cz - h * view.bpp / 2) / span) * span;
  const x1 = view.cx + w * view.bpp / 2;
  const z1 = view.cz + h * view.bpp / 2;
  const out = [];
  for (let z = z0; z < z1; z += span) {
    for (let x = x0; x < x1; x += span) out.push({ originX: x, originZ: z });
  }
  /** @param {{originX: number, originZ: number}} t */
  const d2 = (t) => {
    const mx = t.originX + span / 2 - view.cx, mz = t.originZ + span / 2 - view.cz;
    return mx * mx + mz * mz;
  };
  return out.sort((a, b) => d2(a) - d2(b));
}

// Union of the per-tile present-biome sets, for the legend of a stitched view.
/**
 * @param {Array<{present?: number[]}>} tiles cache entries in view
 * @returns {number[]} unique biome ids
 */
function unionPresent(tiles) {
  const set = new Set();
  for (const t of tiles) for (const id of t.present || []) set.add(id);
  return [...set];
}

export { TILE_CELLS, TILE_GRID_CACHE_MAX, TILE_PAINT_MAX, renderScaleFor, tilesForView, unionPresent };
