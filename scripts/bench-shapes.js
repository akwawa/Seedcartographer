#!/usr/bin/env node
// scripts/bench-shapes.js — micro-benchmark of the geographic-pattern scan,
// run in CI with a time budget so a performance regression fails the build.
//
//   node scripts/bench-shapes.js          # budget from BENCH_SHAPES_BUDGET_MS (default 2000)
//
// The scenario is a demanding one: a 5000-block radius scan over a noisy
// land/water grid with an island clause — every land candidate triggers a
// bounded flood fill.
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { scanGrid } from '../search.js';

// deterministic pseudo-random grid (LCG): island-rich land/water noise
/** @param {number} cols @param {number} rows @returns {Int32Array} */
function buildGrid(cols, rows) {
  const grid = new Int32Array(cols * rows);
  let state = 42;
  for (let i = 0; i < grid.length; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    // ~70% water so land forms small, mostly enclosed patches
    grid[i] = state % 10 < 7 ? 0 : 1;
  }
  return grid;
}

const SC = 16;
const RANGE = 5000;
const cols = Math.ceil((RANGE * 2) / SC) + 2;
const grid = buildGrid(cols, cols);

const params = () => ({
  grid, cols, rows: cols, gx0: 0, gz0: 0, SC,
  cx: RANGE, cz: RANGE, range: RANGE, step: 48, mergeDist: 256,
  mainSet: new Set([1]),
  shapeMode: 'and',
  shapeClauses: [{ kind: 'island', max: 1000 }]
});

let best = Infinity;
let hits = 0;
for (let i = 0; i < 5; i++) {
  const t0 = performance.now();
  hits = scanGrid(params()).length;
  best = Math.min(best, performance.now() - t0);
}

const budget = Number(process.env.BENCH_SHAPES_BUDGET_MS || 2000);
console.log(`shape-scan benchmark: best of 5 = ${best.toFixed(1)} ms (${hits} hits, budget ${budget} ms)`);
if (best > budget) {
  console.error(`FAIL: shape scan took ${best.toFixed(1)} ms, budget is ${budget} ms`);
  process.exit(1);
}
