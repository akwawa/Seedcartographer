'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { scanGrid } = require('../search.js');

// Small synthetic world: SC=16, grid origin at 0/0, scan the whole grid.
const SC = 16;
function makeParams(grid, cols, rows, extra) {
  return Object.assign({
    grid, cols, rows, gx0: 0, gz0: 0, SC,
    cx: Math.floor(cols * SC / 2), cz: Math.floor(rows * SC / 2),
    range: Math.max(cols, rows) * SC,
    step: SC, mergeDist: 0,
    mainSet: new Set([1]),
    adjMode: 'and', adjClauses: [],
    structMode: 'and', structClauses: []
  }, extra);
}
// grid filled with `fill`, with overrides at {i,j:id} cell coords
function makeGrid(cols, rows, fill, cells = []) {
  const g = new Int32Array(cols * rows).fill(fill);
  for (const { i, j, id } of cells) g[j * cols + i] = id;
  return g;
}

test('empty main biome set is rejected', () => {
  assert.equal(scanGrid(makeParams(makeGrid(4, 4, 0), 4, 4, { mainSet: new Set() })), null);
});

test('main biome is an OR over several ids', () => {
  const grid = makeGrid(8, 8, 0, [{ i: 2, j: 2, id: 1 }, { i: 5, j: 5, id: 7 }]);
  const one = scanGrid(makeParams(grid, 8, 8, { mainSet: new Set([1]) }));
  const both = scanGrid(makeParams(grid, 8, 8, { mainSet: new Set([1, 7]) }));
  assert.equal(one.length, 1);
  assert.equal(both.length, 2);
  assert.deepEqual(both.map((h) => [h.x, h.z]), [[2 * SC, 2 * SC], [5 * SC, 5 * SC]]);
});

test('adjacency AND requires every clause, OR requires one', () => {
  // main biome 1 at (4,4); biome 2 next to it; biome 3 nowhere near
  const grid = makeGrid(16, 16, 0, [{ i: 4, j: 4, id: 1 }, { i: 5, j: 4, id: 2 }]);
  const clauses = [
    { biomes: new Set([2]), dist: 64 },
    { biomes: new Set([3]), dist: 64 }
  ];
  const and = scanGrid(makeParams(grid, 16, 16, { adjMode: 'and', adjClauses: clauses }));
  const or = scanGrid(makeParams(grid, 16, 16, { adjMode: 'or', adjClauses: clauses }));
  assert.equal(and.length, 0, 'AND must fail: biome 3 is absent');
  assert.equal(or.length, 1, 'OR must pass: biome 2 is adjacent');
});

test('adjacency respects the distance limit', () => {
  // biome 2 is 6 cells away (96 blocks)
  const grid = makeGrid(16, 16, 0, [{ i: 4, j: 4, id: 1 }, { i: 10, j: 4, id: 2 }]);
  const near = scanGrid(makeParams(grid, 16, 16, { adjClauses: [{ biomes: new Set([2]), dist: 100 }] }));
  const far = scanGrid(makeParams(grid, 16, 16, { adjClauses: [{ biomes: new Set([2]), dist: 50 }] }));
  assert.equal(near.length, 1);
  assert.equal(far.length, 0);
});

test('structure clauses: min count, AND/OR, and total count in hits', () => {
  const grid = makeGrid(8, 8, 1); // everything is the main biome
  const spot = [4 * SC, 4 * SC];
  const villages = { points: [[spot[0] + 10, spot[1]], [spot[0], spot[1] + 20]], min: 2, radius: 100 };
  const monuments = { points: [], min: 1, radius: 100 };
  const and = scanGrid(makeParams(grid, 8, 8, {
    step: 8 * SC, mergeDist: 8 * SC * 2, // single probe at the center
    cx: spot[0], cz: spot[1], range: 0,
    structMode: 'and', structClauses: [villages, monuments]
  }));
  const or = scanGrid(makeParams(grid, 8, 8, {
    step: 8 * SC, mergeDist: 8 * SC * 2,
    cx: spot[0], cz: spot[1], range: 0,
    structMode: 'or', structClauses: [villages, monuments]
  }));
  assert.equal(and.length, 0, 'AND must fail: no monument');
  assert.equal(or.length, 1, 'OR must pass: 2 villages');
  assert.equal(or[0].count, 2);
});

test('nearby hits are merged by mergeDist', () => {
  // two matching cells 1 cell apart
  const grid = makeGrid(8, 8, 0, [{ i: 3, j: 3, id: 1 }, { i: 4, j: 3, id: 1 }]);
  const merged = scanGrid(makeParams(grid, 8, 8, { mergeDist: 2 * SC }));
  const split = scanGrid(makeParams(grid, 8, 8, { mergeDist: 0 }));
  assert.equal(merged.length, 1);
  assert.equal(split.length, 2);
});
