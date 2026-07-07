'use strict';
const test = require('node:test');
const assert = require('node:assert');
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
  assert.strictEqual(scanGrid(makeParams(makeGrid(4, 4, 0), 4, 4, { mainSet: new Set() })), null);
});

test('main biome is an OR over several ids', () => {
  const grid = makeGrid(8, 8, 0, [{ i: 2, j: 2, id: 1 }, { i: 5, j: 5, id: 7 }]);
  const one = scanGrid(makeParams(grid, 8, 8, { mainSet: new Set([1]) }));
  const both = scanGrid(makeParams(grid, 8, 8, { mainSet: new Set([1, 7]) }));
  assert.strictEqual(one.length, 1);
  assert.strictEqual(both.length, 2);
  assert.deepStrictEqual(both.map((h) => [h.x, h.z]), [[2 * SC, 2 * SC], [5 * SC, 5 * SC]]);
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
  assert.strictEqual(and.length, 0, 'AND must fail: biome 3 is absent');
  assert.strictEqual(or.length, 1, 'OR must pass: biome 2 is adjacent');
});

test('adjacency respects the distance limit', () => {
  // biome 2 is 6 cells away (96 blocks)
  const grid = makeGrid(16, 16, 0, [{ i: 4, j: 4, id: 1 }, { i: 10, j: 4, id: 2 }]);
  const near = scanGrid(makeParams(grid, 16, 16, { adjClauses: [{ biomes: new Set([2]), dist: 100 }] }));
  const far = scanGrid(makeParams(grid, 16, 16, { adjClauses: [{ biomes: new Set([2]), dist: 50 }] }));
  assert.strictEqual(near.length, 1);
  assert.strictEqual(far.length, 0);
});

test('negated adjacency requires the biome to be absent', () => {
  // main biome 1 at (4,4), unwanted biome 2 right next to it
  const grid = makeGrid(16, 16, 0, [{ i: 4, j: 4, id: 1 }, { i: 5, j: 4, id: 2 }]);
  const without2 = scanGrid(makeParams(grid, 16, 16, { adjClauses: [{ biomes: new Set([2]), dist: 64, negate: true }] }));
  const without3 = scanGrid(makeParams(grid, 16, 16, { adjClauses: [{ biomes: new Set([3]), dist: 64, negate: true }] }));
  assert.strictEqual(without2.length, 0, 'biome 2 is nearby, spot must be rejected');
  assert.strictEqual(without3.length, 1, 'biome 3 is absent, spot must pass');
});

test('negated clauses combine with positive ones in AND mode', () => {
  // main biome 1 at (4,4); biome 2 adjacent (wanted), biome 3 adjacent (unwanted)
  const grid = makeGrid(16, 16, 0, [
    { i: 4, j: 4, id: 1 }, { i: 5, j: 4, id: 2 }, { i: 3, j: 4, id: 3 }
  ]);
  const wanted = [{ biomes: new Set([2]), dist: 64 }];
  const both = scanGrid(makeParams(grid, 16, 16, {
    adjMode: 'and',
    adjClauses: [...wanted, { biomes: new Set([3]), dist: 64, negate: true }]
  }));
  const positiveOnly = scanGrid(makeParams(grid, 16, 16, { adjMode: 'and', adjClauses: wanted }));
  assert.strictEqual(positiveOnly.length, 1);
  assert.strictEqual(both.length, 0, 'unwanted biome 3 nearby must disqualify the spot');
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
  assert.strictEqual(and.length, 0, 'AND must fail: no monument');
  assert.strictEqual(or.length, 1, 'OR must pass: 2 villages');
  assert.strictEqual(or[0].count, 2);
});

test('sliced row-band scan gives the same result as a full scan', () => {
  // scattered main-biome cells with some neighbours to merge
  const cells = [];
  for (let k = 0; k < 40; k++) cells.push({ i: (k * 7) % 32, j: (k * 11) % 32, id: 1 });
  const grid = makeGrid(32, 32, 0, cells);
  const base = makeParams(grid, 32, 32, { mergeDist: 3 * SC });
  const full = scanGrid(base);
  let acc = [];
  for (let j = 0; j < 32; j += 5) {
    acc = scanGrid(Object.assign({}, base, { rowStart: j, rowEnd: Math.min(j + 4, 31), hits: acc }));
  }
  assert.deepStrictEqual(acc, full);
});

test('nearby hits are merged by mergeDist', () => {
  // two matching cells 1 cell apart
  const grid = makeGrid(8, 8, 0, [{ i: 3, j: 3, id: 1 }, { i: 4, j: 3, id: 1 }]);
  const merged = scanGrid(makeParams(grid, 8, 8, { mergeDist: 2 * SC }));
  const split = scanGrid(makeParams(grid, 8, 8, { mergeDist: 0 }));
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(split.length, 2);
});

test('surface clause filters candidates and only samples passing cells', () => {
  const grid = makeGrid(8, 8, 1);
  const sampled = [];
  const heightAt = (x, z) => { sampled.push([x, z]); return x >= 64 ? 200 : 70; };
  // min only
  let hits = scanGrid(makeParams(grid, 8, 8, { surface: { min: 150, heightAt } }));
  assert.ok(hits.length > 0);
  for (const h of hits) assert.ok(h.x >= 64);
  // every candidate cell passed the biome criterion, so all were sampled
  assert.strictEqual(sampled.length, 64);
  // min+max band excludes the peaks
  hits = scanGrid(makeParams(grid, 8, 8, { surface: { min: 60, max: 100, heightAt } }));
  for (const h of hits) assert.ok(h.x < 64);
  // the callback never runs for cells that fail the biome criterion
  sampled.length = 0;
  const sparse = makeGrid(8, 8, 2, [{ i: 3, j: 3, id: 1 }]);
  hits = scanGrid(makeParams(sparse, 8, 8, { surface: { min: 0, heightAt } }));
  assert.deepStrictEqual(sampled, [[48, 48]]);
  assert.strictEqual(hits.length, 1);
  // no heightAt -> clause ignored
  hits = scanGrid(makeParams(grid, 8, 8, { surface: { min: 9999 } }));
  assert.ok(hits.length > 0);
});

test('pairMidpoints yields midpoints of distinct close pairs only', () => {
  const { pairMidpoints } = require('../search.js');
  const a = [[0, 0], [1000, 1000]];
  const b = [[100, 0], [5000, 5000], [0, 0]];
  // (0,0)-(100,0) is the only pair within 200; identical points are skipped
  assert.deepStrictEqual(pairMidpoints(a, b, 200), [[50, 0]]);
  // same-type pair: both orders produce midpoints, identical instances skipped
  const same = [[0, 0], [100, 0]];
  assert.deepStrictEqual(pairMidpoints(same, same, 200), [[50, 0], [50, 0]]);
  // cap respected
  assert.strictEqual(pairMidpoints(a, b, 1e9, 1).length, 1);
  assert.deepStrictEqual(pairMidpoints([], b, 200), []);
});

test('inMain structure clauses only count structures on main-set cells', () => {
  // 8x8 grid of biome 2 with a single main-biome (1) cell at (2,2)
  const grid = makeGrid(8, 8, 2, [{ i: 2, j: 2, id: 1 }]);
  const onMain = [32, 32];      // inside cell (2,2)
  const offMain = [80, 80];     // cell (5,5), biome 2
  const params = makeParams(grid, 8, 8, {
    structClauses: [{ points: [onMain, offMain], min: 2, radius: 4000, inMain: true }]
  });
  // only one of the two points survives the inMain filter: min 2 fails
  assert.deepStrictEqual(scanGrid(params), []);
  params.structClauses = [{ points: [onMain, offMain], min: 1, radius: 4000, inMain: true }];
  const hits = scanGrid(params);
  assert.ok(hits.length > 0);
  // without the flag both points count
  params.structClauses = [{ points: [onMain, offMain], min: 2, radius: 4000 }];
  assert.ok(scanGrid(params).length > 0);
});
