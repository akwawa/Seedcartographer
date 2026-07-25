// Tests for composition.js (#286): disc sampling of a biome grid and the
// count -> sorted-percentage aggregation shown by the composition panel.
import test from 'node:test';
import assert from 'node:assert';
import { discCounts, rectCounts, rectSurface, rectSampleStep, compositionShares } from '../composition.js';

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

// ---------- rectCounts (#319) ----------

test('rectCounts counts every cell of a uniform grid', () => {
  const grid = new Int32Array(12).fill(7);
  assert.deepStrictEqual([...rectCounts(grid, 4, 3).entries()], [[7, 12]]);
});

test('rectCounts splits the counts between the biomes of the grid', () => {
  // 3x2 grid: left column biome 1, the rest biome 2
  const counts = rectCounts([1, 2, 2, 1, 2, 2], 3, 2);
  assert.strictEqual(counts.get(1), 2);
  assert.strictEqual(counts.get(2), 4);
});

test('rectCounts of an empty grid yields an empty map', () => {
  assert.deepStrictEqual([...rectCounts([], 0, 0).entries()], []);
});

// ---------- rectSurface (#319) ----------

test('rectSurface of a single block is 1 block and 1 chunk', () => {
  assert.deepStrictEqual(rectSurface({ x0: 5, z0: 5, x1: 5, z1: 5, w: 1, h: 1 }),
    { blocks: 1, chunks: 1 });
});

test('rectSurface counts blocks with both edges inclusive', () => {
  // 0..15 x 0..15 = exactly one chunk of 256 blocks
  assert.deepStrictEqual(rectSurface({ x0: 0, z0: 0, x1: 15, z1: 15, w: 16, h: 16 }),
    { blocks: 256, chunks: 1 });
});

test('rectSurface counts every chunk the rectangle intersects', () => {
  // 15..16 crosses a chunk border on both axes: 2x2 chunks for 4 blocks
  assert.deepStrictEqual(rectSurface({ x0: 15, z0: 15, x1: 16, z1: 16, w: 2, h: 2 }),
    { blocks: 4, chunks: 4 });
});

test('rectSurface handles negative coordinates across chunk borders', () => {
  // -1..0: chunks -1 and 0 on each axis
  assert.deepStrictEqual(rectSurface({ x0: -1, z0: -1, x1: 0, z1: 0, w: 2, h: 2 }),
    { blocks: 4, chunks: 4 });
  // fully inside chunk -1 (-16..-1)
  assert.deepStrictEqual(rectSurface({ x0: -16, z0: -9, x1: -9, z1: -1, w: 8, h: 9 }),
    { blocks: 72, chunks: 1 });
});

// ---------- rectSampleStep (#319) ----------

test('rectSampleStep picks the finest 1:4 scale for small selections', () => {
  assert.strictEqual(rectSampleStep(1, 1), 4);
  assert.strictEqual(rectSampleStep(512, 512), 4); // 128*128 = 16384 cells
});

test('rectSampleStep coarsens as the selection grows', () => {
  assert.strictEqual(rectSampleStep(513, 512), 16);
  assert.strictEqual(rectSampleStep(2048, 2048), 16);
  assert.strictEqual(rectSampleStep(8192, 8192), 64);
  assert.strictEqual(rectSampleStep(32768, 32768), 256);
  assert.strictEqual(rectSampleStep(16384, 4096), 64);
});

test('rectSampleStep falls back to the coarsest scale for huge selections', () => {
  assert.strictEqual(rectSampleStep(10_000_000, 10_000_000), 256);
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
