// palette.js — high-visibility (colorblind-friendly) biome colors. Pure,
// shared between worker.js (importScripts, tile painting), app.js (script
// tag, legend and dropdown swatches) and the Node test suite (require).
//
// The alternative palette cycles the Okabe–Ito colorblind-safe hues by biome
// id and modulates each hue by the ORIGINAL color's luminance, so the
// land/water/elevation structure of the default map survives while every
// hue stays distinguishable under the common color-vision deficiencies.
'use strict';

/** @type {Array<[number, number, number]>} Okabe–Ito palette (Ito & Okabe, 2008) */
const OKABE_ITO = [
  [230, 159, 0], [86, 180, 233], [0, 158, 115], [240, 228, 66],
  [0, 114, 178], [213, 94, 0], [204, 121, 167], [153, 153, 153]
];

// High-visibility color of one biome: safe hue picked by id, shaded by the
// luminance of the default color.
/**
 * @param {number} id biome id (0..255)
 * @param {ArrayLike<number>} base default [r, g, b]
 * @returns {[number, number, number]}
 */
function altRgb(id, base) {
  const lum = (0.299 * base[0] + 0.587 * base[1] + 0.114 * base[2]) / 255;
  const hue = OKABE_ITO[id % OKABE_ITO.length];
  const s = 0.3 + 0.7 * lum;   // never fully black: hue must stay readable
  return [Math.round(hue[0] * s), Math.round(hue[1] * s), Math.round(hue[2] * s)];
}

// Remap a whole 256×3 engine color table; the worker swaps this table in so
// tile painting stays free of per-pixel branching.
/**
 * @param {ArrayLike<number>} baseTable default colors, 256*3 bytes
 * @returns {Uint8Array} high-visibility colors, 256*3 bytes
 */
function altBiomeColors(baseTable) {
  const out = new Uint8Array(256 * 3);
  for (let id = 0; id < 256; id++) {
    const c = altRgb(id, [baseTable[id * 3], baseTable[id * 3 + 1], baseTable[id * 3 + 2]]);
    out[id * 3] = c[0]; out[id * 3 + 1] = c[1]; out[id * 3 + 2] = c[2];
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OKABE_ITO, altRgb, altBiomeColors };
}
