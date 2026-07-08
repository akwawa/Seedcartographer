// maptools.js — pure helpers for the map navigation aids: graphic scale bar,
// adaptive coordinate grid and overview minimap. Shared between app.js
// (script tag) and the Node test suite (require).
'use strict';

// Longest "nice" length (1, 2 or 5 × 10^n blocks) that fits in maxPx screen
// pixels at bpp blocks-per-pixel.
/**
 * @param {number} bpp blocks per screen pixel
 * @param {number} [maxPx] maximum bar length in screen pixels
 * @returns {{blocks: number, px: number}} bar length in blocks and pixels
 */
function scaleBarSpec(bpp, maxPx = 140) {
  const maxBlocks = Math.max(1, maxPx * bpp);
  let best = 1;
  for (let pow = 1; pow <= 1e8; pow *= 10) {
    for (const m of [1, 2, 5]) {
      if (m * pow <= maxBlocks) best = m * pow;
    }
  }
  return { blocks: best, px: best / bpp };
}

// Adaptive grid spacing: chunks (16) when they are readable, otherwise
// regions (512) or coarser powers, so lines never crowd the map.
/** @type {Array<[number, string]>} */
const GRID_STEPS = [
  [16, 'chunk'], [128, 'octochunk'], [512, 'region'],
  [4096, 'coarse'], [32768, 'coarse'], [262144, 'coarse']
];
/**
 * @param {number} bpp blocks per screen pixel
 * @param {number} [minPx] minimum spacing between lines in screen pixels
 * @returns {{step: number, kind: string}} grid spacing in blocks
 */
function gridSpec(bpp, minPx = 24) {
  for (const [step, kind] of GRID_STEPS) {
    if (step / bpp >= minPx) return { step, kind };
  }
  const [step, kind] = GRID_STEPS.at(-1);
  return { step, kind };
}

// All multiples of `step` within [w0, w1] (world coordinates, inclusive).
/**
 * @param {number} w0 range start
 * @param {number} w1 range end
 * @param {number} step grid spacing
 * @returns {number[]} grid line coordinates
 */
function gridLines(w0, w1, step) {
  const out = [];
  for (let v = Math.ceil(w0 / step) * step; v <= w1; v += step) out.push(v);
  return out;
}

// The minimap shows the same center at a fixed zoom-out factor.
const MINIMAP_ZOOM_OUT = 8;

// World coordinates of a click at (px, py) on a w×h minimap.
/**
 * @param {number} px click x on the minimap
 * @param {number} py click y on the minimap
 * @param {number} w minimap width in pixels
 * @param {number} h minimap height in pixels
 * @param {{cx: number, cz: number, bpp: number}} view the main view
 * @returns {{x: number, z: number}} world point to recenter on
 */
function minimapClickToWorld(px, py, w, h, view) {
  const bpp = view.bpp * MINIMAP_ZOOM_OUT;
  return { x: Math.round(view.cx + (px - w / 2) * bpp), z: Math.round(view.cz + (py - h / 2) * bpp) };
}

// The main viewport (mainW×mainH screen pixels) as a rectangle on the
// minimap; both share the same center, so the rectangle is centered too.
/**
 * @param {number} mainW main canvas width in screen pixels
 * @param {number} mainH main canvas height in screen pixels
 * @param {number} mmW minimap width in pixels
 * @param {number} mmH minimap height in pixels
 * @returns {{x: number, y: number, w: number, h: number}}
 */
function viewportRectOnMinimap(mainW, mainH, mmW, mmH) {
  const w = mainW / MINIMAP_ZOOM_OUT, h = mainH / MINIMAP_ZOOM_OUT;
  return { x: mmW / 2 - w / 2, y: mmH / 2 - h / 2, w, h };
}

// Portal-planning grid: "nice" grid steps of the LINKED dimension
// (Overworld <-> Nether, 1:8), expressed in current-dimension blocks so the
// overlay can be drawn directly on the map. Returns null for the End.
/**
 * @param {number} dim current dimension (0 Overworld, -1 Nether, 1 End)
 * @param {number} bpp blocks per screen pixel in the current dimension
 * @param {number} [minPx] minimum on-screen spacing between lines
 * @returns {{currentStep: number, factor: number, label: string}|null}
 *          factor converts current-dim blocks to linked-dim blocks (x / factor)
 */
function linkedGridSpec(dim, bpp, minPx = 48) {
  if (dim !== 0 && dim !== -1) return null;
  const factor = dim === 0 ? 8 : 1 / 8;   // linked -> current scale
  // pick a nice step in the linked dimension, seen at its apparent zoom
  const { step } = gridSpec(bpp / factor, minPx);
  return { currentStep: step * factor, factor, label: dim === 0 ? 'Nether' : 'Overworld' };
}

// Farthest coordinate reachable in Java (the world border).
const GOTO_LIMIT = 29999984;

// Parse a "go to" input — two integers separated by a comma, semicolon or
// whitespace ("100, -250", "100 -250"…). Returns null when the text is not
// two coordinates or one of them lies beyond the world border.
/**
 * @param {string} str raw field content
 * @returns {{x: number, z: number}|null} world point, or null when invalid
 */
function parseGotoInput(str) {
  // the separator alternation is unambiguous (comma/semicolon vs pure
  // whitespace), so the regex cannot backtrack super-linearly
  const m = /^\s*(-?\d+)(?:\s*[,;]\s*|\s+)(-?\d+)\s*$/.exec(String(str ?? ''));
  if (!m) return null;
  const x = Number.parseInt(m[1], 10), z = Number.parseInt(m[2], 10);
  if (Math.abs(x) > GOTO_LIMIT || Math.abs(z) > GOTO_LIMIT) return null;
  return { x, z };
}

// Selection rectangle from two dragged corners, in world blocks: ordered
// corners plus the block dimensions (inclusive of both edges).
/**
 * @param {{x: number, z: number}} a first corner
 * @param {{x: number, z: number}} b opposite corner
 * @returns {{x0: number, z0: number, x1: number, z1: number, w: number, h: number}}
 */
function normalizeRect(a, b) {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
  const z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
  return { x0, z0, x1, z1, w: x1 - x0 + 1, h: z1 - z0 + 1 };
}

// Human-readable form of a selection, used by the copy-coordinates action.
/**
 * @param {{x0: number, z0: number, x1: number, z1: number, w: number, h: number}} r
 * @returns {string}
 */
function formatRect(r) {
  return `${r.x0}, ${r.z0} -> ${r.x1}, ${r.z1} (${r.w} x ${r.h})`;
}

// Ruler measurement between two world points: Euclidean distance and
// per-axis deltas, all in blocks.
/**
 * @param {{x: number, z: number}} a first endpoint
 * @param {{x: number, z: number}} b second endpoint
 * @returns {{dist: number, dx: number, dz: number}}
 */
function rulerMeasure(a, b) {
  return {
    dist: Math.round(Math.hypot(b.x - a.x, b.z - a.z)),
    dx: Math.abs(b.x - a.x),
    dz: Math.abs(b.z - a.z)
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scaleBarSpec, gridSpec, gridLines, MINIMAP_ZOOM_OUT, minimapClickToWorld, viewportRectOnMinimap, parseGotoInput, GOTO_LIMIT, rulerMeasure, linkedGridSpec, normalizeRect, formatRect };
}
