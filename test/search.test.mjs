import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import test from 'node:test';
import assert from 'node:assert';
const { scanGrid, sortHitsByDist } = require('../search.js');

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

const { SEARCH_MAX_HITS } = require('../search.js');

test('or-mode structure clauses reject a cell when none matches', () => {
  const grid = [7, 7, 7, 7];
  const p = {
    grid, cols: 2, rows: 2, gx0: 0, gz0: 0, SC: 16,
    cx: 16, cz: 16, range: 32, step: 16, mergeDist: 0,
    mainSet: new Set([7]),
    structMode: 'or',
    structClauses: [{ points: [], min: 1, radius: 100 }, { points: [], min: 1, radius: 100 }]
  };
  assert.deepStrictEqual(scanGrid(p), []);
});

test('scanGrid defaults: no clause lists, sub-cell step clamps the stride', () => {
  const grid = [7, 7, 7, 7];
  const hits = scanGrid({
    grid, cols: 2, rows: 2, gx0: 0, gz0: 0, SC: 16,
    cx: 16, cz: 16, range: 32, step: 1, mergeDist: 0,   // step < SC
    mainSet: new Set([7])
  });
  assert.strictEqual(hits.length, 4);
});

test('the hit cap stops the scan and short-circuits full accumulators', () => {
  // 64x64 all-matching cells with no merging: more candidates than the cap
  const n = 64;
  const grid = new Array(n * n).fill(7);
  const p = {
    grid, cols: n, rows: n, gx0: 0, gz0: 0, SC: 16,
    cx: (n * 16) / 2, cz: (n * 16) / 2, range: n * 16, step: 16, mergeDist: 0,
    mainSet: new Set([7])
  };
  const hits = scanGrid(p);
  assert.strictEqual(hits.length, SEARCH_MAX_HITS);
  // calling again with a full accumulator returns immediately
  assert.strictEqual(scanGrid({ ...p, hits }), hits);
});

test('sortHitsByDist orders results closest-to-origin first and is stable', () => {
  const hits = [
    { x: 100, z: 0, tag: 'far' },
    { x: 10, z: 10, tag: 'near-a' },
    { x: -10, z: -10, tag: 'near-b' },   // same distance as near-a
    { x: 0, z: 5, tag: 'nearest' }
  ];
  const sorted = sortHitsByDist(hits, { x: 0, z: 0 });
  assert.deepStrictEqual(sorted.map((h) => h.tag), ['nearest', 'near-a', 'near-b', 'far']);
  // input untouched
  assert.strictEqual(hits[0].tag, 'far');
  // non-zero origin changes the winner
  assert.strictEqual(sortHitsByDist(hits, { x: 100, z: 0 })[0].tag, 'far');
});

test('percentage clause: enough share passes, too little fails', () => {
  // 9x9 grid, main biome 1 at the center, half the disc is biome 2
  const cells = [{ i: 4, j: 4, id: 1 }];
  for (let j = 0; j < 9; j++) for (let i = 0; i < 4; i++) cells.push({ i, j, id: 2 });
  const grid = makeGrid(9, 9, 0, cells);
  const low = scanGrid(makeParams(grid, 9, 9, {
    pctMode: 'and', pctClauses: [{ biomes: new Set([2]), dist: 64, pct: 30 }]
  }));
  assert.strictEqual(low.length, 1, 'biome 2 covers well over 30% of the disc');
  const high = scanGrid(makeParams(grid, 9, 9, {
    pctMode: 'and', pctClauses: [{ biomes: new Set([2]), dist: 64, pct: 90 }]
  }));
  assert.strictEqual(high.length, 0, 'biome 2 covers far less than 90%');
});

test('percentage clause: 100% passes on a uniform disc', () => {
  // everything is biome 1: the main spot and the whole disc qualify
  const grid = makeGrid(9, 9, 1);
  const hits = scanGrid(makeParams(grid, 9, 9, {
    pctClauses: [{ biomes: new Set([1]), dist: 64, pct: 100 }]
  }));
  assert.ok(hits.length > 0);
});

test('percentage clauses combine with AND and OR', () => {
  // half biome 2 around the spot, no biome 3 at all
  const cells = [{ i: 4, j: 4, id: 1 }];
  for (let j = 0; j < 9; j++) for (let i = 0; i < 4; i++) cells.push({ i, j, id: 2 });
  const grid = makeGrid(9, 9, 0, cells);
  const clauses = [
    { biomes: new Set([2]), dist: 64, pct: 20 },   // satisfied
    { biomes: new Set([3]), dist: 64, pct: 20 }    // not satisfied
  ];
  const and = scanGrid(makeParams(grid, 9, 9, { pctMode: 'and', pctClauses: clauses }));
  assert.strictEqual(and.length, 0, 'AND fails when one clause fails');
  const or = scanGrid(makeParams(grid, 9, 9, { pctMode: 'or', pctClauses: clauses }));
  assert.strictEqual(or.length, 1, 'OR passes when one clause holds');
});

test('percentage clause sub-steps on large radii and still estimates the share', () => {
  // 101x101 grid: west half biome 2, main spot at the center. dist=640
  // (40 cells) triggers the sub-stepped scan (sub=2).
  const cells = [{ i: 50, j: 50, id: 1 }];
  for (let j = 0; j < 101; j++) for (let i = 0; i < 50; i++) cells.push({ i, j, id: 2 });
  const grid = makeGrid(101, 101, 0, cells);
  // biome 1 only exists at the center, so it is the only candidate cell
  const ok = scanGrid(makeParams(grid, 101, 101, {
    pctClauses: [{ biomes: new Set([2]), dist: 640, pct: 30 }]
  }));
  const no = scanGrid(makeParams(grid, 101, 101, {
    pctClauses: [{ biomes: new Set([2]), dist: 640, pct: 80 }]
  }));
  assert.ok(ok.some((h) => h.x === 50 * SC && h.z === 50 * SC), '~50% share passes a 30% floor');
  assert.ok(!no.some((h) => h.x === 50 * SC && h.z === 50 * SC), '~50% share fails an 80% floor');
});

test('an adjacency clause can target an extra Y layer', () => {
  // main grid: biome 1 at the center, no biome 9 anywhere
  const grid = makeGrid(8, 8, 0, [{ i: 4, j: 4, id: 1 }]);
  // deep layer: biome 9 right under the spot
  const deep = makeGrid(8, 8, 0, [{ i: 4, j: 4, id: 9 }]);
  const layers = [{ y: -40, grid: deep }];
  const hit = scanGrid(makeParams(grid, 8, 8, {
    layers, adjClauses: [{ biomes: new Set([9]), dist: 64, y: -40 }]
  }));
  assert.strictEqual(hit.length, 1, 'the deep clause reads the -40 layer');
  const miss = scanGrid(makeParams(grid, 8, 8, {
    layers, adjClauses: [{ biomes: new Set([9]), dist: 64 }]
  }));
  assert.strictEqual(miss.length, 0, 'without y the clause reads the main grid');
  // combining a surface clause and a deep clause on the same spot
  const both = scanGrid(makeParams(makeGrid(8, 8, 0, [{ i: 4, j: 4, id: 1 }, { i: 5, j: 4, id: 2 }]), 8, 8, {
    layers,
    adjMode: 'and',
    adjClauses: [
      { biomes: new Set([2]), dist: 64 },
      { biomes: new Set([9]), dist: 64, y: -40 }
    ]
  }));
  assert.strictEqual(both.length, 1, 'surface AND depth clauses can coincide');
  // a null y is the same as no y (share-link shape)
  const nullY = scanGrid(makeParams(grid, 8, 8, {
    layers, adjClauses: [{ biomes: new Set([9]), dist: 64, y: null }]
  }));
  assert.strictEqual(nullY.length, 0);
});

test('a clause asking for a missing layer makes the request malformed', () => {
  const grid = makeGrid(8, 8, 0, [{ i: 4, j: 4, id: 1 }]);
  assert.strictEqual(scanGrid(makeParams(grid, 8, 8, {
    adjClauses: [{ biomes: new Set([9]), dist: 64, y: -40 }]
  })), null);
});
