import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import test from 'node:test';
import assert from 'node:assert';
const { WATER_BIOMES, floodComponent, prepShapeClauses, shapeClauseOk, shapePass } = require('../shapes.js');
const { scanGrid } = require('../search.js');

const SC = 16;
const LAND = 1, PLAINS = 1, DESERT = 2, OCEAN = 0;

function grid(cols, rows, fill, cells = []) {
  const g = new Int32Array(cols * rows).fill(fill);
  for (const { i, j, id } of cells) g[j * cols + i] = id;
  return g;
}
// a solid square of `id` centered on (ci, cj)
function square(ci, cj, half, id) {
  const out = [];
  for (let j = cj - half; j <= cj + half; j++) {
    for (let i = ci - half; i <= ci + half; i++) out.push({ i, j, id });
  }
  return out;
}
function prep(clauses, cols, rows) {
  return prepShapeClauses(clauses, SC, cols, rows);
}

test('floodComponent measures a bounded component and its frontier', () => {
  // 3x3 land square in an ocean
  const g = grid(9, 9, OCEAN, square(4, 4, 1, LAND));
  const scratch = { stamp: new Int32Array(81), gen: 0, queue: new Int32Array(82) };
  const comp = floodComponent({ grid: g, cols: 9, rows: 9 }, 4, 4, (id) => !WATER_BIOMES.has(id), 100, scratch);
  assert.strictEqual(comp.size, 9);
  assert.strictEqual(comp.overflow, false);
  assert.strictEqual(comp.touchedEdge, false);
  assert.ok(comp.frontier.every((id) => id === OCEAN));
  // the cap makes big components overflow instead of scanning forever
  const capped = floodComponent({ grid: g, cols: 9, rows: 9 }, 0, 0, (id) => WATER_BIOMES.has(id), 5, scratch);
  assert.strictEqual(capped.overflow, true);
});

test('island: land fully surrounded by water within the size bound', () => {
  const cols = 15, rows = 15;
  const island = grid(cols, rows, OCEAN, square(7, 7, 2, LAND));
  const hit = scanGrid({
    grid: island, cols, rows, gx0: 0, gz0: 0, SC,
    cx: 7 * SC, cz: 7 * SC, range: cols * SC, step: SC, mergeDist: 0,
    mainSet: new Set([LAND]),
    shapeMode: 'and', shapeClauses: [{ kind: 'island', max: 640 }]
  });
  assert.ok(hit.length > 0, 'the islet is found');
  // continental land (touches the analysis window edge) is not an island
  const mainland = grid(cols, rows, LAND);
  const none = scanGrid({
    grid: mainland, cols, rows, gx0: 0, gz0: 0, SC,
    cx: 7 * SC, cz: 7 * SC, range: cols * SC, step: SC, mergeDist: 0,
    mainSet: new Set([LAND]),
    shapeClauses: [{ kind: 'island', max: 640 }]
  });
  assert.strictEqual(none.length, 0);
});

test('lagoon: enclosed water passes, open ocean does not', () => {
  const cols = 15, rows = 15;
  const lagoon = grid(cols, rows, LAND, square(7, 7, 1, OCEAN));
  const params = (g, clauses) => ({
    grid: g, cols, rows, gx0: 0, gz0: 0, SC,
    cx: 7 * SC, cz: 7 * SC, range: cols * SC, step: SC, mergeDist: 0,
    mainSet: new Set([OCEAN]), shapeClauses: clauses
  });
  assert.ok(scanGrid(params(lagoon, [{ kind: 'lagoon', max: 640 }])).length > 0);
  const sea = grid(cols, rows, OCEAN);
  assert.strictEqual(scanGrid(params(sea, [{ kind: 'lagoon', max: 640 }])).length, 0);
});

test('enclave: biome A enclosed by biome B, and only by it', () => {
  const cols = 15, rows = 15;
  const enclave = grid(cols, rows, PLAINS, square(7, 7, 1, DESERT));
  const params = (clauses, mode) => ({
    grid: enclave, cols, rows, gx0: 0, gz0: 0, SC,
    cx: 7 * SC, cz: 7 * SC, range: cols * SC, step: SC, mergeDist: 0,
    mainSet: new Set([DESERT]), shapeMode: mode, shapeClauses: clauses
  });
  assert.ok(scanGrid(params([{ kind: 'enclave', a: new Set([DESERT]), b: new Set([PLAINS]), max: 640 }])).length > 0);
  // wrong surrounding biome: no match
  assert.strictEqual(scanGrid(params([{ kind: 'enclave', a: new Set([DESERT]), b: new Set([OCEAN]), max: 640 }])).length, 0);
  // OR mode: one passing clause is enough
  const or = scanGrid(params([
    { kind: 'enclave', a: new Set([DESERT]), b: new Set([OCEAN]), max: 640 },
    { kind: 'enclave', a: new Set([DESERT]), b: new Set([PLAINS]), max: 640 }
  ], 'or'));
  assert.ok(or.length > 0);
});

test('the size bound rejects patterns larger than max', () => {
  const cols = 21, rows = 21;
  // a 9x9 island: passes with a generous bound, fails with a small one
  const island = grid(cols, rows, OCEAN, square(10, 10, 4, LAND));
  const params = (max) => ({
    grid: island, cols, rows, gx0: 0, gz0: 0, SC,
    cx: 10 * SC, cz: 10 * SC, range: cols * SC, step: SC, mergeDist: 0,
    mainSet: new Set([LAND]), shapeClauses: [{ kind: 'island', max }]
  });
  assert.ok(scanGrid(params(2000)).length > 0);
  assert.strictEqual(scanGrid(params(64)).length, 0);
});

test('malformed shape clauses make the request malformed', () => {
  const g = grid(9, 9, LAND);
  const base = {
    grid: g, cols: 9, rows: 9, gx0: 0, gz0: 0, SC,
    cx: 0, cz: 0, range: 200, step: SC, mergeDist: 0, mainSet: new Set([LAND])
  };
  assert.strictEqual(scanGrid({ ...base, shapeClauses: [{ kind: 'volcano', max: 640 }] }), null);
  assert.strictEqual(scanGrid({ ...base, shapeClauses: [{ kind: 'island', max: 0 }] }), null);
  assert.strictEqual(scanGrid({ ...base, shapeClauses: [{ kind: 'enclave', max: 640 }] }), null);
  assert.strictEqual(scanGrid({ ...base, shapeClauses: [{ kind: 'enclave', a: new Set([1]), b: new Set(), max: 640 }] }), null);
});

test('shapeClauseOk requires the start cell to belong to the pattern', () => {
  const g = { grid: grid(9, 9, OCEAN, square(4, 4, 1, LAND)), cols: 9, rows: 9 };
  const [c] = prep([{ kind: 'island', max: 640 }], 9, 9);
  assert.strictEqual(shapeClauseOk(c, g, 0, 0), false, 'a water cell is not on the island');
  assert.strictEqual(shapeClauseOk(c, g, 4, 4), true);
});

test('shapePass AND requires every clause', () => {
  const g = { grid: grid(9, 9, OCEAN, square(4, 4, 1, LAND)), cols: 9, rows: 9 };
  const clauses = prep([{ kind: 'island', max: 640 }, { kind: 'lagoon', max: 640 }], 9, 9);
  assert.strictEqual(shapePass(clauses, true, g, 4, 4), false);
  assert.strictEqual(shapePass(clauses, false, g, 4, 4), true);
  assert.strictEqual(shapePass([], true, g, 4, 4), true);
});
