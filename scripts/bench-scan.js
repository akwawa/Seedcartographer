#!/usr/bin/env node
// scripts/bench-scan.js — micro-benchmark of scanGrid on synthetic grids of
// realistic size, run in CI with a time budget so a performance regression
// fails the build. Usage:
//
//   node scripts/bench-scan.js            # budget from BENCH_BUDGET_MS (default 2000)
//
// The scenario mirrors a demanding real search: 5000-block radius at 16-block
// cells with an adjacency clause and a structure clause.
'use strict';
const { performance } = require('node:perf_hooks');
const { scanGrid } = require('../search.js');

// deterministic pseudo-random biome grid (LCG): benchmark inputs must not
// vary between runs or machines
function buildGrid(cols, rows, biomes) {
  const grid = new Int32Array(cols * rows);
  let state = 42;
  for (let i = 0; i < grid.length; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    grid[i] = biomes[state % biomes.length];
  }
  return grid;
}

// evenly spread synthetic structure points over the block box
function buildPoints(count, extent) {
  const points = [];
  const stride = Math.floor((2 * extent) / Math.sqrt(count));
  for (let z = -extent; z < extent && points.length < count; z += stride) {
    for (let x = -extent; x < extent && points.length < count; x += stride) {
      points.push([x, z]);
    }
  }
  return points;
}

// one full scan over a (2*range/SC)^2 grid; returns {ms, hits}
function runScenario({ range = 5000, SC = 16, step = 48 } = {}) {
  const pad = 400;
  const gx0 = Math.floor((-range - pad) / SC), gz0 = gx0;
  const cols = Math.ceil((range + pad) / SC) - gx0 + 2;
  const grid = buildGrid(cols, cols, [1, 4, 5, 44, 185]);
  const params = {
    grid, cols, rows: cols, gx0, gz0, SC,
    cx: 0, cz: 0, range, step, mergeDist: Math.max(256, step * 6),
    mainSet: new Set([185]),
    adjMode: 'and',
    adjClauses: [{ biomes: new Set([44]), dist: 400 }],
    structMode: 'and',
    structClauses: [{ points: buildPoints(400, range), min: 1, radius: 800 }]
  };
  const t0 = performance.now();
  const hits = scanGrid(params);
  return { ms: performance.now() - t0, hits: hits ? hits.length : -1 };
}

// best-of-N wall time smooths out CI runner noise
function bench(iterations = 5, options) {
  let best = Infinity, hits = -1;
  for (let i = 0; i < iterations; i++) {
    const r = runScenario(options);
    if (r.ms < best) best = r.ms;
    hits = r.hits;
  }
  return { best, hits };
}

if (require.main === module) {
  const budget = parseInt(process.env.BENCH_BUDGET_MS || '2000', 10);
  const { best, hits } = bench();
  console.log(`scanGrid benchmark: best of 5 = ${best.toFixed(1)} ms (${hits} hits, budget ${budget} ms)`);
  if (hits < 0) {
    console.error('benchmark scenario returned no result — inputs are invalid');
    process.exit(2);
  }
  if (best > budget) {
    console.error(`performance regression: ${best.toFixed(1)} ms exceeds the ${budget} ms budget`);
    process.exit(1);
  }
}

module.exports = { buildGrid, buildPoints, runScenario, bench };
