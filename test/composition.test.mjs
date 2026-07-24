// Tests for composition.js (#286): disc sampling of a biome grid and the
// count -> sorted-percentage aggregation shown by the composition panel.
import test from 'node:test';
import assert from 'node:assert';
import { discCounts, compositionShares } from '../composition.js';

// ---------- discCounts ----------

test('discCounts counts every cell of a uniform grid inside the disc', () => {
  // 5x5 grid of biome 7, cell 16 blocks, radius 32 -> cells = 2, full disc
  const grid = new Int32Array(25).fill(7);
  const counts = discCounts(grid, 5, 5, 2, 2, 16, 32);
  // disc of radius 2 cells: 13 cells (center + 4 + 8)
  assert.deepStrictEqual([...counts.entries()], [[7, 13]]);
});

test('discCounts splits the counts between the biomes of the disc', () => {
  // left half biome 1, right half biome 2 (center column included right)
  const grid = [];
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) grid.push(i < 2 ? 1 : 2);
  const counts = discCounts(grid, 5, 5, 2, 2, 16, 32);
  assert.strictEqual(counts.get(1), 4);
  assert.strictEqual(counts.get(2), 9);
});

test('discCounts skips the cells falling outside the grid', () => {
  // center in the NW corner: three quarters of the disc are off-grid
  const grid = new Int32Array(25).fill(3);
  const counts = discCounts(grid, 5, 5, 0, 0, 16, 32);
  assert.strictEqual(counts.get(3), 6); // quarter disc incl. axes
});

test('discCounts excludes the corners beyond the block radius', () => {
  // radius 16 = 1 cell: the 4 diagonal neighbours are sqrt(2)*16 away
  const grid = new Int32Array(9).fill(5);
  const counts = discCounts(grid, 3, 3, 1, 1, 16, 16);
  assert.strictEqual(counts.get(5), 5);
});

test('discCounts with a radius under one cell keeps only the center', () => {
  const grid = [9, 9, 9, 9];
  const counts = discCounts(grid, 2, 2, 1, 1, 16, 8);
  assert.deepStrictEqual([...counts.entries()], [[9, 1]]);
});

test('discCounts clips against the far edges of the grid too', () => {
  // center in the SE corner: nj/ni >= rows/cols branches
  const grid = new Int32Array(25).fill(4);
  const counts = discCounts(grid, 5, 5, 4, 4, 16, 32);
  assert.strictEqual(counts.get(4), 6);
});

// ---------- compositionShares ----------

test('compositionShares returns an empty list for empty counts', () => {
  assert.deepStrictEqual(compositionShares(new Map()), []);
});

test('a single biome gets exactly 100%', () => {
  assert.deepStrictEqual(compositionShares(new Map([[14, 42]])),
    [{ id: 14, count: 42, pct: 100 }]);
});

test('exact shares need no remainder distribution and sum to 100', () => {
  // 1/4, 1/4, 1/2: all tenths are integral, the leftover loop breaks at once
  const list = compositionShares(new Map([[1, 1], [2, 1], [3, 2]]));
  assert.deepStrictEqual(list, [
    { id: 3, count: 2, pct: 50 },
    { id: 1, count: 1, pct: 25 },
    { id: 2, count: 1, pct: 25 }
  ]);
});

test('largest-remainder rounding keeps the one-decimal sum at exactly 100', () => {
  // thirds: 33.333...% each -> exactly one entry gets bumped to 33.4
  const list = compositionShares(new Map([[1, 1], [2, 1], [3, 1]]));
  const sum = list.reduce((s, e) => s + e.pct, 0);
  assert.strictEqual(Math.round(sum * 10), 1000);
  assert.deepStrictEqual(list.map((e) => e.pct).sort((a, b) => b - a), [33.4, 33.3, 33.3]);
});

test('sevenths sum to 100.0 despite awkward remainders', () => {
  const counts = new Map([[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1]]);
  const list = compositionShares(counts);
  assert.strictEqual(Math.round(list.reduce((s, e) => s + e.pct, 0) * 10), 1000);
  assert.strictEqual(list.length, 7);
});

test('the list is sorted by decreasing percentage', () => {
  const list = compositionShares(new Map([[8, 1], [2, 6], [5, 3]]));
  assert.deepStrictEqual(list.map((e) => e.id), [2, 5, 8]);
  assert.deepStrictEqual(list.map((e) => e.count), [6, 3, 1]);
});

test('equal shares fall back to the id order for a stable display', () => {
  const list = compositionShares(new Map([[9, 5], [3, 5]]));
  assert.deepStrictEqual(list.map((e) => e.id), [3, 9]);
  assert.strictEqual(list[0].pct + list[1].pct, 100);
});

test('a rounding bump breaks a percentage tie by the raw count', () => {
  // 2/3 vs 1/3 of 3 cells... use counts whose pcts tie after rounding:
  // 1,1,2,2 of 6 -> 16.7, 16.7, 33.3, 33.3 (two bumps): count tiebreak used
  const list = compositionShares(new Map([[4, 1], [1, 1], [2, 2], [3, 2]]));
  assert.strictEqual(Math.round(list.reduce((s, e) => s + e.pct, 0) * 10), 1000);
  assert.deepStrictEqual(list.map((e) => e.id), [2, 3, 1, 4]);
});
