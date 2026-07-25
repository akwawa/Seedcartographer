// view3d.js — pure geometry for the lightweight isometric terrain view
// (#325). The worker samples a bounded grid of columns (surface height +
// biome color) over the visible map area; these helpers turn that grid into
// a classic 2:1 isometric drawing: sampling step, painter's-algorithm
// traversal under a 0/90/180/270° rotation, projection, canvas layout and
// face tints. ES module shared between app.js and the Node test suite —
// no DOM, no canvas.

// biome sampling scales supported by the generator, finest first
const VIEW3D_STEPS = [4, 16, 64, 256];
// column budget: at most 128×128 columns per request, whatever the zoom
export const VIEW3D_MAX_CELLS = 128 * 128;

/**
 * Sampling step for a w×h-block visible area: the finest generator scale
 * that keeps the column grid under VIEW3D_MAX_CELLS (same adaptive idea as
 * rectSampleStep in composition.js).
 * @param {number} w visible width in blocks
 * @param {number} h visible height in blocks
 * @returns {number} cell size in blocks (4, 16, 64 or 256)
 */
export function view3dSampleStep(w, h) {
  for (const s of VIEW3D_STEPS) {
    if (Math.ceil(w / s) * Math.ceil(h / s) <= VIEW3D_MAX_CELLS) return s;
  }
  return VIEW3D_STEPS.at(-1);
}

/**
 * Column grid covering the visible world rectangle: NW cell coordinates,
 * grid size and the adaptive sampling step.
 * @param {number} x0 west edge (blocks)
 * @param {number} z0 north edge (blocks)
 * @param {number} x1 east edge (blocks)
 * @param {number} z1 south edge (blocks)
 * @returns {{ci0: number, cj0: number, cols: number, rows: number, sc: number}}
 */
export function view3dGrid(x0, z0, x1, z1) {
  const sc = view3dSampleStep(x1 - x0, z1 - z0);
  const ci0 = Math.floor(x0 / sc), cj0 = Math.floor(z0 / sc);
  return {
    ci0, cj0,
    cols: Math.floor(x1 / sc) - ci0 + 1,
    rows: Math.floor(z1 / sc) - cj0 + 1,
    sc
  };
}

/**
 * Size of the rotated grid: quarter turns swap columns and rows.
 * @param {number} cols grid width in columns
 * @param {number} rows grid height in columns
 * @param {number} rot rotation in quarter turns (0..3)
 * @returns {{cols: number, rows: number}}
 */
export function rotatedSize(cols, rows, rot) {
  return rot % 2 === 1 ? { cols: rows, rows: cols } : { cols, rows };
}

/**
 * Index into the original row-major grid of the rotated position (u, v).
 * Iterating v then u (both ascending) walks the world back-to-front for the
 * 2:1 projection, whatever the rotation — the painter's-algorithm order.
 * @param {number} u rotated column (0..rotatedSize().cols-1)
 * @param {number} v rotated row (0..rotatedSize().rows-1)
 * @param {number} cols original grid width
 * @param {number} rows original grid height
 * @param {number} rot rotation in quarter turns (0..3)
 * @returns {number} row-major index into the original grid
 */
export function rotatedIndex(u, v, cols, rows, rot) {
  if (rot === 1) return (rows - 1 - u) * cols + v;
  if (rot === 2) return (rows - 1 - v) * cols + (cols - 1 - u);
  if (rot === 3) return u * cols + (cols - 1 - v);
  return v * cols + u;
}

/**
 * Classic 2:1 isometric projection of a column top center.
 * @param {number} u rotated column
 * @param {number} v rotated row
 * @param {number} lift height offset in pixels (0 = ground plane)
 * @param {{tile: number, ox: number, oy: number}} lay layout from view3dLayout()
 * @returns {{x: number, y: number}} canvas coordinates of the diamond center
 */
export function isoProject(u, v, lift, lay) {
  return {
    x: lay.ox + (u - v) * lay.tile / 2,
    y: lay.oy + (u + v) * lay.tile / 4 - lift
  };
}

/**
 * Canvas layout for a rotated cols×rows grid: tile size fitted to a target
 * width (clamped so columns never degenerate), pixels-per-block vertical
 * unit, projection origin and the exact canvas size (columns and side faces
 * included).
 * @param {number} cols rotated grid width
 * @param {number} rows rotated grid height
 * @param {number} widthPx target drawing width in pixels
 * @param {number} span height range of the grid in blocks (max - min)
 * @param {number} hScale user height-scale factor (0.5, 1 or 2)
 * @returns {{tile: number, hUnit: number, ox: number, oy: number, width: number, height: number}}
 */
export function view3dLayout(cols, rows, widthPx, span, hScale) {
  const tile = Math.max(2, Math.min(24, Math.floor(2 * widthPx / (cols + rows))));
  const hUnit = hScale * tile / 16;      // vertical pixels per block of height
  const maxLift = span * hUnit;
  const ox = rows * tile / 2;
  const oy = maxLift + tile / 4;
  return {
    tile, hUnit, ox, oy,
    width: Math.ceil((cols + rows) * tile / 2),
    // ground plane of the front corner + its diamond bottom + the plinth
    // that every column keeps below its side faces (drawColumn)
    height: Math.ceil(oy + (cols + rows - 2) * tile / 4 + tile / 2 + tile / 4)
  };
}

/**
 * Multiply an rgb color, clamped to [0, 255].
 * @param {ArrayLike<number>} rgb [r, g, b]
 * @param {number} f multiplier
 * @returns {number[]} shaded [r, g, b]
 */
export function shadeRgb(rgb, f) {
  const clamp = (/** @type {number} */ c) => Math.min(255, Math.max(0, Math.round(c * f)));
  return [clamp(rgb[0]), clamp(rgb[1]), clamp(rgb[2])];
}

// face tints: the top brightens with altitude, the two visible side faces
// darken (the right one more, faking a fixed light from the left)
const TOP_LIGHTEN = 0.25;
const LEFT_SHADE = 0.68;
const RIGHT_SHADE = 0.5;

/**
 * Tints of the three visible faces of a column.
 * @param {ArrayLike<number>} rgb biome color [r, g, b]
 * @param {number} hNorm normalized height (0 = lowest, 1 = highest column)
 * @returns {{top: number[], left: number[], right: number[]}}
 */
export function faceShades(rgb, hNorm) {
  return {
    top: shadeRgb(rgb, 1 + TOP_LIGHTEN * hNorm),
    left: shadeRgb(rgb, LEFT_SHADE),
    right: shadeRgb(rgb, RIGHT_SHADE)
  };
}

/**
 * CSS color string of an rgb triplet.
 * @param {ArrayLike<number>} rgb [r, g, b]
 * @returns {string}
 */
export function cssRgb(rgb) {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

/**
 * Height range of a column grid.
 * @param {ArrayLike<number>} heights sampled surface heights (blocks)
 * @returns {{min: number, span: number}} lowest height and max - min (0 when empty)
 */
export function heightSpan(heights) {
  if (heights.length === 0) return { min: 0, span: 0 };
  let min = heights[0], max = heights[0];
  for (let i = 1; i < heights.length; i++) {
    if (heights[i] < min) min = heights[i];
    if (heights[i] > max) max = heights[i];
  }
  return { min, span: max - min };
}

/**
 * Normalized height of one column (0..1), safe on flat terrain.
 * @param {number} h column height (blocks)
 * @param {{min: number, span: number}} range from heightSpan()
 * @returns {number}
 */
export function heightNorm(h, range) {
  return range.span > 0 ? (h - range.min) / range.span : 0;
}
