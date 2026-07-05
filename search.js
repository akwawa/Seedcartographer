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
//   adjMode, adjClauses              — 'and'|'or', [{biomes:Set, dist}]
//   structMode, structClauses        — 'and'|'or', [{points:[[x,z]], min, radius}]
function scanGrid(p) {
  const { grid, cols, rows, gx0, gz0, SC, cx, cz, range, mergeDist } = p;
  const mainSet = p.mainSet;
  const adjClauses = p.adjClauses || [];
  const structClauses = p.structClauses || [];
  const adjAll = p.adjMode !== 'or';
  const structAll = p.structMode !== 'or';
  if (!mainSet || !mainSet.size) return null;

  // pre-compute per-clause cell radii and sub-steps (same speedup as the C scan)
  const adj = adjClauses.map((c) => {
    const cells = Math.floor(c.dist / SC);
    return { biomes: c.biomes, dist2: c.dist * c.dist, cells, sub: cells > 20 ? Math.floor(cells / 20) : 1 };
  });
  const structs = structClauses.map((c) => ({ points: c.points, min: c.min, r2: c.radius * c.radius }));

  let stride = Math.floor(p.step / SC); if (stride < 1) stride = 1;
  const merge2 = mergeDist * mergeDist;

  // cell-index bounds of the (unpadded) search box within the grid
  let bi0 = Math.floor((cx - range - gx0 * SC) / SC), bi1 = Math.floor((cx + range - gx0 * SC) / SC);
  let bj0 = Math.floor((cz - range - gz0 * SC) / SC), bj1 = Math.floor((cz + range - gz0 * SC) / SC);
  if (bi0 < 0) bi0 = 0; if (bj0 < 0) bj0 = 0;
  if (bi1 > cols - 1) bi1 = cols - 1; if (bj1 > rows - 1) bj1 = rows - 1;

  const hits = [];
  for (let cj = bj0; cj <= bj1; cj += stride) {
    for (let ci = bi0; ci <= bi1; ci += stride) {
      if (!mainSet.has(grid[cj * cols + ci])) continue;
      const wx = gx0 * SC + ci * SC;
      const wz = gz0 * SC + cj * SC;

      // adjacency clauses
      if (adj.length) {
        let pass = adjAll;
        for (const c of adj) {
          let found = false;
          for (let dj = -c.cells; dj <= c.cells && !found; dj += c.sub) {
            const nj = cj + dj; if (nj < 0 || nj >= rows) continue;
            for (let di = -c.cells; di <= c.cells; di += c.sub) {
              const ni = ci + di; if (ni < 0 || ni >= cols) continue;
              if ((di * SC) * (di * SC) + (dj * SC) * (dj * SC) > c.dist2) continue;
              if (c.biomes.has(grid[nj * cols + ni])) { found = true; break; }
            }
          }
          if (adjAll && !found) { pass = false; break; }
          if (!adjAll && found) { pass = true; break; }
        }
        if (!pass) continue;
      }

      // structure clauses
      let count = 0;
      if (structs.length) {
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
          if (structAll && !ok) { pass = false; break; }
          if (!structAll && ok) { pass = true; }
        }
        if (!pass) continue;
        count = total;
      }

      // duplicate merge
      let dup = false;
      for (const h of hits) {
        const dx = h.x - wx, dz = h.z - wz;
        if (dx * dx + dz * dz <= merge2) { dup = true; break; }
      }
      if (dup) continue;

      hits.push({ x: wx, z: wz, count });
      if (hits.length >= SEARCH_MAX_HITS) return hits;
    }
  }
  return hits;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scanGrid, SEARCH_MAX_HITS, SEARCH_MAX_CELLS };
}
