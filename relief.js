// relief.js — pure hillshade math for the terrain relief layer (Overworld).
// The worker samples the engine's approximate surface height on a coarse
// grid over each tile, this module turns those heights into per-cell shade
// multipliers. Shared between worker.js (importScripts) and the Node test
// suite (require).
'use strict';

// Sampling step in tile cells: heights are sampled every STEP cells and
// upsampled bilinearly, keeping the engine-call cost per tile bounded.
// Zoomed out (coarse scales) the terrain detail is sub-pixel anyway, so the
// grid gets coarser: 64x64 samples at close zoom, 32x32 far out.
/**
 * @param {number} scale blocks per tile cell (4, 16, 64 or 256)
 * @returns {number} sampling step in cells
 */
function reliefSampleStep(scale) {
  return scale >= 64 ? 8 : 4;
}

// Shade multipliers from a height grid, light from the north-west (the
// usual cartographic convention): slopes facing NW brighten, slopes facing
// SE darken, flat ground stays at 1. Central differences where possible,
// one-sided on the borders.
const RELIEF_STRENGTH = 1.1;   // multiplier swing per 45-degree slope
const RELIEF_MIN = 0.62;       // clamp: valleys never go fully black
const RELIEF_MAX = 1.30;       // clamp: ridges never blow out to white
/**
 * @param {ArrayLike<number>} heights row-major sample grid (blocks)
 * @param {number} cols sample-grid width
 * @param {number} rows sample-grid height
 * @param {number} cellBlocks world distance between two samples (blocks)
 * @returns {Float32Array} shade multiplier per sample, same layout
 */
function hillshade(heights, cols, rows, cellBlocks) {
  const out = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const iw = i > 0 ? i - 1 : i, ie = i < cols - 1 ? i + 1 : i;
      const jn = j > 0 ? j - 1 : j, js = j < rows - 1 ? j + 1 : j;
      const dx = (heights[j * cols + ie] - heights[j * cols + iw]) / ((ie - iw) * cellBlocks || 1);
      const dz = (heights[js * cols + i] - heights[jn * cols + i]) / ((js - jn) * cellBlocks || 1);
      // NW light: terrain rising toward the SE tilts its face to the NW
      // (normal ~ (-dx, 1, -dz), light ray ~ (1, -1, 1)), so it is lit
      const shade = 1 + RELIEF_STRENGTH * ((dx + dz) / 2);
      out[j * cols + i] = Math.min(RELIEF_MAX, Math.max(RELIEF_MIN, shade));
    }
  }
  return out;
}

// Bilinear upsample of the sample-grid shade to the full tile-cell grid.
// Samples sit at the center of every `step`-th cell block.
/**
 * @param {ArrayLike<number>} shade sample grid from hillshade()
 * @param {number} sCols sample-grid width
 * @param {number} sRows sample-grid height
 * @param {number} step cells between two samples
 * @param {number} cols tile width in cells
 * @param {number} rows tile height in cells
 * @returns {Float32Array} shade multiplier per tile cell
 */
function upsampleShade(shade, sCols, sRows, step, cols, rows) {
  const out = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    const fz = Math.min(sRows - 1, Math.max(0, (j - step / 2) / step));
    const j0 = Math.floor(fz), j1 = Math.min(sRows - 1, j0 + 1), tz = fz - j0;
    for (let i = 0; i < cols; i++) {
      const fx = Math.min(sCols - 1, Math.max(0, (i - step / 2) / step));
      const i0 = Math.floor(fx), i1 = Math.min(sCols - 1, i0 + 1), tx = fx - i0;
      const top = shade[j0 * sCols + i0] * (1 - tx) + shade[j0 * sCols + i1] * tx;
      const bot = shade[j1 * sCols + i0] * (1 - tx) + shade[j1 * sCols + i1] * tx;
      out[j * cols + i] = top * (1 - tz) + bot * tz;
    }
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { reliefSampleStep, hillshade, upsampleShade, RELIEF_MIN, RELIEF_MAX };
}
