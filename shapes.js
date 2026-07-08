// shapes.js — geographic-pattern detection on a biome grid: island (land
// enclosed by water), lagoon/bay (water enclosed by land) and enclave
// (biome A enclosed by biome B), via bounded connected-component analysis.
// Pure, shared between worker.js (importScripts, via search.js) and the
// Node test suite (require).
'use strict';

// water biome ids (cubiomes): oceans, deep oceans, rivers and their frozen
// variants — everything a boat floats on
const WATER_BIOMES = new Set([0, 7, 10, 11, 24, 44, 45, 46, 47, 48, 49, 50]);

const SHAPE_KINDS = new Set(['island', 'lagoon', 'enclave']);
const SHAPE_MAX_BLOCKS = 4000;   // size cap in blocks (keeps the fill bounded)

/**
 * @typedef {{kind: string, a?: Set<number>, b?: Set<number>, max: number}} ShapeClause
 */

// Bounded 4-connected flood fill of the component containing (ci, cj) whose
// cells satisfy `inside`. Uses a generation-stamped visited buffer so
// successive fills never rescan or clear memory.
/**
 * @param {Int32Array|number[]} grid
 * @param {number} cols @param {number} rows
 * @param {number} ci @param {number} cj start cell
 * @param {(id: number) => boolean} inside component membership
 * @param {number} cap max component size in cells
 * @param {{stamp: Int32Array, gen: number, queue: Int32Array}} scratch
 * @returns {{size: number, overflow: boolean, touchedEdge: boolean,
 *            frontier: number[]}} component stats; `frontier` lists the
 *            biome ids of the cells immediately outside the component
 */
function floodComponent(grid, cols, rows, ci, cj, inside, cap, scratch) {
  const { stamp, queue } = scratch;
  const gen = ++scratch.gen;
  const frontier = [];
  let head = 0, tail = 0, size = 0, touchedEdge = false;
  queue[tail++] = cj * cols + ci;
  stamp[cj * cols + ci] = gen;
  while (head < tail) {
    const idx = queue[head++];
    const x = idx % cols, z = (idx - x) / cols;
    if (!inside(grid[idx])) { frontier.push(grid[idx]); continue; }
    if (++size > cap) return { size, overflow: true, touchedEdge, frontier };
    if (x === 0 || z === 0 || x === cols - 1 || z === rows - 1) touchedEdge = true;
    tail = pushNeighbors(idx, x, cols, rows, gen, scratch, tail);
  }
  return { size, overflow: false, touchedEdge, frontier };
}

// enqueue the unvisited 4-neighbors of `idx` (no wrap across grid edges)
/** @param {number} idx @param {number} x @param {number} cols @param {number} rows @param {number} gen @param {{stamp: Int32Array, queue: Int32Array}} scratch @param {number} tail @returns {number} new queue tail */
function pushNeighbors(idx, x, cols, rows, gen, scratch, tail) {
  const { stamp, queue } = scratch;
  for (const n of [idx - 1, idx + 1, idx - cols, idx + cols]) {
    // stay on the row for horizontal moves
    if (n === idx - 1 && x === 0) continue;
    if (n === idx + 1 && x === cols - 1) continue;
    if (n < 0 || n >= cols * rows || stamp[n] === gen) continue;
    stamp[n] = gen;
    queue[tail++] = n;
  }
  return tail;
}

// membership/enclosure predicates per pattern kind
/** @param {ShapeClause} c @returns {{inside: (id: number) => boolean, encloses: (id: number) => boolean}} */
function shapePredicates(c) {
  if (c.kind === 'island') {
    return { inside: (id) => !WATER_BIOMES.has(id), encloses: (id) => WATER_BIOMES.has(id) };
  }
  if (c.kind === 'lagoon') {
    return { inside: (id) => WATER_BIOMES.has(id), encloses: (id) => !WATER_BIOMES.has(id) };
  }
  // enclave clauses are validated before this runs: a and b are present
  const a = c.a, b = c.b;
  return { inside: (id) => a.has(id), encloses: (id) => b.has(id) };
}

// Prepared clauses share one scratch buffer sized for the grid; `capCells`
// converts the block-size bound to component cells.
/**
 * @param {ShapeClause[]} clauses
 * @param {number} SC blocks per cell
 * @param {number} cols @param {number} rows
 * @returns {object[]|null} null when a clause is malformed
 */
function prepShapeClauses(clauses, SC, cols, rows) {
  if (!clauses.length) return [];
  const scratch = { stamp: new Int32Array(cols * rows), gen: 0, queue: new Int32Array(cols * rows + 1) };
  const out = [];
  for (const c of clauses) {
    if (!SHAPE_KINDS.has(c.kind)) return null;
    if (c.kind === 'enclave' && (!c.a?.size || !c.b?.size)) return null;
    const max = Math.min(SHAPE_MAX_BLOCKS, c.max);
    if (!Number.isFinite(max) || max <= 0) return null;
    const side = Math.max(1, Math.floor(max / SC));
    out.push({ ...shapePredicates(c), capCells: side * side, scratch });
  }
  return out;
}

// Does the pattern hold at (ci, cj)? The cell must belong to the component
// (right membership), the component must stay under the size cap, never
// reach the analysis window's edge, and be enclosed only by allowed cells.
/** @param {any} c prepared clause @param {{grid: Int32Array|number[], cols: number, rows: number}} g @param {number} ci @param {number} cj @returns {boolean} */
function shapeClauseOk(c, g, ci, cj) {
  if (!c.inside(g.grid[cj * g.cols + ci])) return false;
  const comp = floodComponent(g.grid, g.cols, g.rows, ci, cj, c.inside, c.capCells, c.scratch);
  if (comp.overflow || comp.touchedEdge) return false;
  return comp.frontier.every((id) => c.encloses(id));
}

// AND/OR combination of the shape clauses for one cell
/** @param {any[]} shapes @param {boolean} shapeAll @param {any} g @param {number} ci @param {number} cj @returns {boolean} */
function shapePass(shapes, shapeAll, g, ci, cj) {
  let pass = shapeAll;
  for (const c of shapes) {
    const ok = shapeClauseOk(c, g, ci, cj);
    if (shapeAll && !ok) return false;
    if (!shapeAll && ok) return true;
  }
  return pass;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WATER_BIOMES, SHAPE_KINDS, SHAPE_MAX_BLOCKS,
    floodComponent, prepShapeClauses, shapeClauseOk, shapePass
  };
}
