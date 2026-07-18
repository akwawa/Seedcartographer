// compare.js — pure logic of the side-by-side seed compare mode (#250).
// Two map views share one viewport (same center and zoom): these helpers
// hold the mode state transitions and the viewport pan/zoom math, so the
// canvas glue in app.js stays a thin layer over testable functions.

// zoom clamps shared with the main map (app.js wheel/keyboard handlers)
export const COMPARE_MIN_BPP = 0.5;
export const COMPARE_MAX_BPP = 512;

/**
 * Clamp a zoom level (blocks per pixel) to the map's supported range.
 * @param {number} bpp blocks per screen pixel
 * @returns {number}
 */
export function clampBpp(bpp) {
  return Math.min(COMPARE_MAX_BPP, Math.max(COMPARE_MIN_BPP, bpp));
}

/**
 * Viewport after a drag of (dxPx, dyPx) screen pixels: the world moves with
 * the pointer, so the center shifts the opposite way.
 * @param {{cx: number, cz: number, bpp: number}} view current viewport
 * @param {number} dxPx pointer delta X in screen pixels
 * @param {number} dyPx pointer delta Y in screen pixels
 * @returns {{cx: number, cz: number, bpp: number}} next viewport
 */
export function panViewport(view, dxPx, dyPx) {
  return { cx: view.cx - dxPx * view.bpp, cz: view.cz - dyPx * view.bpp, bpp: view.bpp };
}

/**
 * Viewport after zooming by `factor` around the screen point (mx, my): the
 * world point under the cursor stays fixed while the scale changes.
 * @param {{cx: number, cz: number, bpp: number}} view current viewport
 * @param {number} w viewport width in screen pixels
 * @param {number} h viewport height in screen pixels
 * @param {number} mx zoom anchor X in screen pixels
 * @param {number} my zoom anchor Y in screen pixels
 * @param {number} factor bpp multiplier (>1 zooms out, <1 zooms in)
 * @returns {{cx: number, cz: number, bpp: number}} next viewport
 */
export function zoomViewportAt(view, w, h, mx, my, factor) {
  const bpp = clampBpp(view.bpp * factor);
  const wx = view.cx + (mx - w / 2) * view.bpp;
  const wz = view.cz + (my - h / 2) * view.bpp;
  return { cx: wx - (mx - w / 2) * bpp, cz: wz - (my - h / 2) * bpp, bpp };
}

/**
 * Whether two viewports show the same center and zoom (sync invariant).
 * @param {{cx: number, cz: number, bpp: number}} a
 * @param {{cx: number, cz: number, bpp: number}} b
 * @returns {boolean}
 */
export function sameViewport(a, b) {
  return a.cx === b.cx && a.cz === b.cz && a.bpp === b.bpp;
}

/**
 * Seed for the compare pane: trimmed user input, or the fallback (the main
 * map's seed) when the field is empty.
 * @param {string|number|null|undefined} raw user input
 * @param {string|number|null|undefined} fallback seed used when raw is empty
 * @returns {string}
 */
export function normalizeCompareSeed(raw, fallback) {
  const s = String(raw ?? '').trim();
  return s !== '' ? s : String(fallback ?? '0').trim() || '0';
}

/**
 * World identity of the compare pane: same version/size/dimension as the
 * main map, with its own seed — the tile cache keys stay comparable.
 * @param {{seed: string|number, mc: number, large: boolean, dim: number}} world main world
 * @param {string} seed compare seed
 * @returns {{seed: string, mc: number, large: boolean, dim: number}}
 */
export function compareWorldFor(world, seed) {
  return { seed, mc: world.mc, large: world.large, dim: world.dim };
}

/**
 * Initial compare-mode state: off, no seed picked yet.
 * @returns {{on: boolean, seed: string}}
 */
export function createCompareState() {
  return { on: false, seed: '' };
}

/**
 * Enter compare mode with a seed (falling back to the main seed when empty).
 * @param {{on: boolean, seed: string}} state current state
 * @param {string|number|null|undefined} seed requested compare seed
 * @param {string|number} fallback main map seed
 * @returns {{on: boolean, seed: string}} next state
 */
export function enterCompare(state, seed, fallback) {
  return { ...state, on: true, seed: normalizeCompareSeed(seed, fallback) };
}

/**
 * Leave compare mode; the last compare seed is kept for the next toggle.
 * @param {{on: boolean, seed: string}} state current state
 * @returns {{on: boolean, seed: string}} next state
 */
export function exitCompare(state) {
  return { ...state, on: false };
}
