// search.js — pure multi-criteria scan over a pre-generated biome grid.
// Shared between worker.js (importScripts) and the Node test suite (require).
// The heavy work (biome grid generation, structure placement) stays in the
// WASM engine; this module only combines the criteria.
'use strict';

const SEARCH_MAX_HITS = 1500;   // result cap, mirrors the old C engine
const SEARCH_MAX_CELLS = 60000000; // grid-size guard, mirrors the old C engine

// Scan `grid` (cols×rows biome ids, NW corner at scaled gx0/gz0, cell size SC
// blocks) for spots matching all criteria. Returns {x,z,count} hits, or null
// if the request is malformed.
//
// params:
//   grid, cols, rows, gx0, gz0, SC  — biome grid (SC = blocks per cell)
//   cx, cz, range                    — search box (blocks, centered)
//   step                             — scan stride in blocks
//   mergeDist                        — duplicate-merge distance in blocks
//   mainSet                          — Set of accepted biome ids for the spot
//   adjMode, adjClauses              — 'and'|'or', [{biomes:Set, dist, negate?}]
//                                      (negate: the biome must be ABSENT within dist)
//   structMode, structClauses        — 'and'|'or', [{points:[[x,z]], min, radius,
//                                      inMain?}] (inMain: only structures on a
//                                      main-set biome cell count)
//   surface (optional)               — {min?, max?, heightAt(x,z)} surface-
//                                      height clause; heightAt is an engine
//                                      callback, so it only runs on cells that
//                                      already passed every other criterion
//   rowStart, rowEnd (optional)      — restrict the scan to grid rows
//                                      [rowStart, rowEnd]; combined with the
//                                      `hits` accumulator this lets a caller
//                                      scan in slices (progress / cancel)
//   hits (optional)                  — accumulator from previous slices, used
//                                      for duplicate-merging across slices
/**
 * @typedef {{biomes: Set<number>, dist: number, negate?: boolean}} AdjClause
 * @typedef {{points: Array<[number, number]>, min: number, radius: number,
 *            inMain?: boolean}} StructClause
 * @typedef {{x: number, z: number, count: number}} SearchHit
 * @typedef {{min?: number|null, max?: number|null,
 *            heightAt: (x: number, z: number) => number}} SurfaceClause
 */
// ---- scanGrid helpers (extracted to keep each function readable) ----

// per-clause cell radii and sub-steps (same speedup as the old C scan)
/** @param {AdjClause[]} clauses @param {number} SC @returns {object[]} */
function prepAdjClauses(clauses, SC) {
  return clauses.map((c) => {
    const cells = Math.floor(c.dist / SC);
    return {
      biomes: c.biomes, negate: !!c.negate,
      dist2: c.dist * c.dist, cells,
      // negated clauses must scan every cell: sub-stepping could miss the
      // one occurrence that should disqualify the spot
      sub: !c.negate && cells > 20 ? Math.floor(cells / 20) : 1
    };
  });
}

// "in main biome" restricts a clause to structures standing on a cell of the
// main-biome set; the grid covers box+pad, so out-of-grid points drop
/**
 * @typedef {{grid: Int32Array|number[], cols: number, rows: number,
 *            gx0: number, gz0: number, SC: number, mainSet: Set<number>}} GridCtx
 */
/** @param {StructClause[]} clauses @param {GridCtx} g @returns {object[]} */
function prepStructClauses(clauses, g) {
  return clauses.map((c) => ({
    points: c.inMain
      ? c.points.filter(([sx, sz]) => {
          const ci = Math.floor((sx - g.gx0 * g.SC) / g.SC), cj = Math.floor((sz - g.gz0 * g.SC) / g.SC);
          return ci >= 0 && cj >= 0 && ci < g.cols && cj < g.rows && g.mainSet.has(g.grid[cj * g.cols + ci]);
        })
      : c.points,
    min: c.min, r2: c.radius * c.radius
  }));
}

// is one of the clause's biomes present within its distance of cell (ci, cj)?
/** @param {any} c @param {GridCtx} g @param {number} ci @param {number} cj @returns {boolean} */
function adjClauseFound(c, g, ci, cj) {
  for (let dj = -c.cells; dj <= c.cells; dj += c.sub) {
    const nj = cj + dj;
    if (nj < 0 || nj >= g.rows) continue;
    for (let di = -c.cells; di <= c.cells; di += c.sub) {
      const ni = ci + di;
      if (ni < 0 || ni >= g.cols) continue;
      if ((di * g.SC) * (di * g.SC) + (dj * g.SC) * (dj * g.SC) > c.dist2) continue;
      if (c.biomes.has(g.grid[nj * g.cols + ni])) return true;
    }
  }
  return false;
}

// AND/OR combination of the adjacency clauses for one cell
/** @param {any[]} adj @param {boolean} adjAll @param {GridCtx} g @param {number} ci @param {number} cj @returns {boolean} */
function adjPass(adj, adjAll, g, ci, cj) {
  let pass = adjAll;
  for (const c of adj) {
    const ok = c.negate ? !adjClauseFound(c, g, ci, cj) : adjClauseFound(c, g, ci, cj);
    if (adjAll && !ok) return false;
    if (!adjAll && ok) return true;
  }
  return pass;
}

// AND/OR combination of the structure clauses; returns the total count of
// nearby structures, or null when the cell fails
/** @param {any[]} structs @param {boolean} structAll @param {number} wx @param {number} wz @returns {number|null} */
function structCount(structs, structAll, wx, wz) {
  let pass = structAll;
  let total = 0;
  for (const c of structs) {
    let n = 0;
    for (const [sx, sz] of c.points) {
      const dx = sx - wx, dz = sz - wz;
      if (dx * dx + dz * dz <= c.r2) n++;
    }
    total += n;
    const ok = n >= c.min;
    if (structAll && !ok) return null;
    if (!structAll && ok) pass = true;
  }
  return pass ? total : null;
}

/** @param {SearchHit[]} hits @param {number} wx @param {number} wz @param {number} merge2 @returns {boolean} */
function isDuplicate(hits, wx, wz, merge2) {
  for (const h of hits) {
    const dx = h.x - wx, dz = h.z - wz;
    if (dx * dx + dz * dz <= merge2) return true;
  }
  return false;
}

// every per-cell criterion in one place: returns the structure count when
// the cell passes, or null when any clause rejects it
/**
 * @param {{g: GridCtx, adj: object[], adjAll: boolean, structs: object[],
 *          structAll: boolean, surf: {min: number, max: number,
 *          heightAt: (x: number, z: number) => number}|null}} ctx
 * @param {number} ci @param {number} cj @param {number} wx @param {number} wz
 * @returns {number|null}
 */
function evalCell(ctx, ci, cj, wx, wz) {
  if (!ctx.g.mainSet.has(ctx.g.grid[cj * ctx.g.cols + ci])) return null;
  if (ctx.adj.length && !adjPass(ctx.adj, ctx.adjAll, ctx.g, ci, cj)) return null;
  let count = 0;
  if (ctx.structs.length) {
    const total = structCount(ctx.structs, ctx.structAll, wx, wz);
    if (total === null) return null;
    count = total;
  }
  // surface-height clause: the engine callback is the most expensive check,
  // so it only runs on cells that passed everything else
  if (ctx.surf) {
    const y = ctx.surf.heightAt(wx, wz);
    if (!(y >= ctx.surf.min && y <= ctx.surf.max)) return null;
  }
  return count;
}

/**
 * @param {{grid: Int32Array|number[], cols: number, rows: number,
 *          gx0: number, gz0: number, SC: number,
 *          cx: number, cz: number, range: number, step: number,
 *          mergeDist: number, mainSet: Set<number>,
 *          adjMode?: string, adjClauses?: AdjClause[],
 *          structMode?: string, structClauses?: StructClause[],
 *          surface?: SurfaceClause|null,
 *          rowStart?: number, rowEnd?: number, hits?: SearchHit[]}} p
 * @returns {SearchHit[]|null} hits, or null when the request is malformed
 */
function scanGrid(p) {
  const { grid, cols, rows, gx0, gz0, SC, cx, cz, range, mergeDist } = p;
  const mainSet = p.mainSet;
  const adjAll = p.adjMode !== 'or';
  const structAll = p.structMode !== 'or';
  if (!mainSet?.size) return null;

  const g = { grid, cols, rows, gx0, gz0, SC, mainSet };
  const adj = prepAdjClauses(p.adjClauses || [], SC);
  const structs = prepStructClauses(p.structClauses || [], g);
  const surf = typeof p.surface?.heightAt === 'function'
    ? { min: p.surface.min ?? -Infinity, max: p.surface.max ?? Infinity, heightAt: p.surface.heightAt }
    : null;

  let stride = Math.floor(p.step / SC);
  if (stride < 1) stride = 1;
  const merge2 = mergeDist * mergeDist;

  // cell-index bounds of the (unpadded) search box within the grid
  const bi0 = Math.max(0, Math.floor((cx - range - gx0 * SC) / SC));
  const bi1 = Math.min(cols - 1, Math.floor((cx + range - gx0 * SC) / SC));
  const bj0 = Math.max(0, Math.floor((cz - range - gz0 * SC) / SC));
  const bj1 = Math.min(rows - 1, Math.floor((cz + range - gz0 * SC) / SC));

  // optional row-slice restriction; iteration still starts at bj0 so the
  // stride alignment is identical to a full scan
  const rowStart = p.rowStart ?? bj0, rowEnd = p.rowEnd ?? bj1;

  const ctx = { g, adj, adjAll, structs, structAll, surf };
  const hits = p.hits || [];
  if (hits.length >= SEARCH_MAX_HITS) return hits;
  for (let cj = bj0; cj <= bj1; cj += stride) {
    if (cj < rowStart || cj > rowEnd) continue;
    for (let ci = bi0; ci <= bi1; ci += stride) {
      const wx = gx0 * SC + ci * SC;
      const wz = gz0 * SC + cj * SC;
      const count = evalCell(ctx, ci, cj, wx, wz);
      if (count === null || isDuplicate(hits, wx, wz, merge2)) continue;
      hits.push({ x: wx, z: wz, count });
      if (hits.length >= SEARCH_MAX_HITS) return hits;
    }
  }
  return hits;
}

// Midpoints of every (a, b) pair closer than `gap` blocks (distinct points
// only). These act as pseudo-structure positions for "T1 and T2 near each
// other" criteria.
/**
 * @param {Array<[number, number]>} pointsA positions of the first type
 * @param {Array<[number, number]>} pointsB positions of the second type
 * @param {number} gap maximum distance between the two structures (blocks)
 * @param {number} [cap] result cap
 * @returns {Array<[number, number]>} pair midpoints
 */
function pairMidpoints(pointsA, pointsB, gap, cap = SEARCH_MAX_HITS) {
  /** @type {Array<[number, number]>} */
  const out = [];
  const g2 = gap * gap;
  for (const [ax, az] of pointsA) {
    for (const [bx, bz] of pointsB) {
      if (ax === bx && az === bz) continue;   // the same structure instance
      const dx = ax - bx, dz = az - bz;
      if (dx * dx + dz * dz > g2) continue;
      out.push([Math.round((ax + bx) / 2), Math.round((az + bz) / 2)]);
      if (out.length >= cap) return out;
    }
  }
  return out;
}

// Results sorted by distance to a reference point (typically the world
// spawn), closest first; ties keep the incoming order (stable sort). The
// input list is left untouched.
/**
 * @param {Array<{x: number, z: number}>} hits search results
 * @param {{x: number, z: number}} origin reference point
 * @returns {Array<{x: number, z: number}>} new sorted array
 */
function sortHitsByDist(hits, origin) {
  const d2 = (/** @type {{x: number, z: number}} */ h) => (h.x - origin.x) ** 2 + (h.z - origin.z) ** 2;
  return [...hits].sort((a, b) => d2(a) - d2(b));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scanGrid, pairMidpoints, SEARCH_MAX_HITS, SEARCH_MAX_CELLS, sortHitsByDist };
}
