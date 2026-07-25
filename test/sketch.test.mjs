// sketch.js (#326): biome families, sketch transforms/scoring, sanitization
// and the scanGrid integration of the sketch criterion.
import test from 'node:test';
import assert from 'node:assert';
import {
  SKETCH_SIZE, SKETCH_CELL_BLOCKS, SKETCH_PAD_BLOCKS,
  SKETCH_FAMILIES, SKETCH_FAMILY_COLORS,
  biomeFamily, rotateSketch, mirrorSketch, sketchVariants,
  sketchScore, bestSketchScore, sanitizeSketch, prepSketch,
  dominantFamilies, sketchPass
} from '../sketch.js';
import { scanGrid } from '../search.js';

const N = SKETCH_SIZE * SKETCH_SIZE;
// build a 25-cell sketch from {index: family} overrides
function sk(cells = {}) {
  const g = new Array(N).fill('');
  for (const [i, f] of Object.entries(cells)) g[Number(i)] = f;
  return g;
}

test('sketch constants are consistent', () => {
  assert.strictEqual(SKETCH_SIZE, 5);
  assert.strictEqual(SKETCH_PAD_BLOCKS, SKETCH_CELL_BLOCKS * SKETCH_SIZE / 2);
  for (const f of SKETCH_FAMILIES) assert.match(SKETCH_FAMILY_COLORS[f], /^#[0-9a-f]{6}$/);
});

test('biomeFamily groups cubiomes ids into families', () => {
  assert.strictEqual(biomeFamily(0), 'ocean');       // ocean
  assert.strictEqual(biomeFamily(7), 'ocean');       // river floats too
  assert.strictEqual(biomeFamily(1), 'plains');
  assert.strictEqual(biomeFamily(185), 'forest');    // cherry grove
  assert.strictEqual(biomeFamily(165), 'desert');    // eroded badlands
  assert.strictEqual(biomeFamily(180), 'mountain');  // jagged peaks
  assert.strictEqual(biomeFamily(140), 'snow');      // ice spikes
  assert.strictEqual(biomeFamily(168), 'jungle');    // bamboo jungle
  assert.strictEqual(biomeFamily(184), 'swamp');     // mangrove swamp
  assert.strictEqual(biomeFamily(14), null);         // mushroom fields: no family
  assert.strictEqual(biomeFamily(999), null);
});

test('rotateSketch turns the grid 90° clockwise, mirrorSketch flips it', () => {
  // NW corner marked: after one CW rotation it sits in the NE corner
  const g = sk({ 0: 'ocean' });
  assert.strictEqual(rotateSketch(g)[4], 'ocean');
  assert.strictEqual(mirrorSketch(g)[4], 'ocean');
  // four rotations (or two mirrors) restore the original
  let r = g;
  for (let i = 0; i < 4; i++) r = rotateSketch(r);
  assert.deepStrictEqual(r, g);
  assert.deepStrictEqual(mirrorSketch(mirrorSketch(g)), g);
});

test('sketchVariants enumerates the enabled orientations', () => {
  const g = sk({ 0: 'ocean' });
  assert.strictEqual(sketchVariants(g, false, false).length, 1);
  assert.strictEqual(sketchVariants(g, true, false).length, 4);
  assert.strictEqual(sketchVariants(g, false, true).length, 2);
  assert.strictEqual(sketchVariants(g, true, true).length, 8);
  // the input is never mutated
  assert.strictEqual(g[0], 'ocean');
});

test('sketchScore is the matched share of the constrained cells', () => {
  const wanted = sk({ 0: 'ocean', 1: 'forest' });
  const actual = new Array(N).fill(null);
  actual[0] = 'ocean'; actual[1] = 'desert';
  assert.strictEqual(sketchScore(actual, wanted), 0.5);
  actual[1] = 'forest';
  assert.strictEqual(sketchScore(actual, wanted), 1);
  // an all-indifferent sketch scores 0, it anchors nothing
  assert.strictEqual(sketchScore(actual, sk()), 0);
});

test('bestSketchScore tests rotations and mirrors when enabled', () => {
  const wanted = sk({ 0: 'ocean' });          // NW corner
  const actual = new Array(N).fill(null);
  actual[4] = 'ocean';                        // NE corner
  assert.strictEqual(bestSketchScore(actual, wanted), 0);
  assert.strictEqual(bestSketchScore(actual, wanted, { rot: true }), 1);
  assert.strictEqual(bestSketchScore(actual, wanted, { mir: true }), 1);
  // a matching base orientation needs no option at all
  actual[0] = 'ocean';
  assert.strictEqual(bestSketchScore(actual, wanted), 1);
});

test('sanitizeSketch coerces untrusted payloads and drops empty ones', () => {
  assert.strictEqual(sanitizeSketch(null), null);
  assert.strictEqual(sanitizeSketch('evil'), null);
  assert.strictEqual(sanitizeSketch({ g: 'nope' }), null);
  // junk families become indifferent; an all-indifferent sketch is dropped
  assert.strictEqual(sanitizeSketch({ g: ['<img>', 42] }), null);
  const c = sanitizeSketch({ g: ['ocean', '<img>'], r: 1, m: 0, p: '250' });
  assert.strictEqual(c.g.length, N);
  assert.strictEqual(c.g[0], 'ocean');
  assert.strictEqual(c.g[1], '');
  assert.deepStrictEqual([c.r, c.m, c.p], [1, 0, 100]);
  // p is clamped low, defaults on junk; r/m are coerced to 0/1
  assert.strictEqual(sanitizeSketch({ g: ['ocean'], p: -3 }).p, 1);
  const d = sanitizeSketch({ g: ['ocean'], r: 0, m: 'yes', p: 'zz' });
  assert.deepStrictEqual([d.r, d.m, d.p], [0, 1, 60]);
  // an oversized grid is truncated to 25 cells
  assert.strictEqual(sanitizeSketch({ g: new Array(40).fill('ocean'), p: 50 }).g.length, N);
});

test('prepSketch validates the clause and prepares the scan parameters', () => {
  assert.strictEqual(prepSketch(null, 16), null);
  assert.strictEqual(prepSketch({ cells: 'x', pct: 50 }, 16), null);
  assert.strictEqual(prepSketch({ cells: ['ocean'], pct: 50 }, 16), null);
  assert.strictEqual(prepSketch({ cells: sk({ 0: 'evil' }), pct: 50 }, 16), null);
  assert.strictEqual(prepSketch({ cells: sk(), pct: 50 }, 16), null);
  assert.strictEqual(prepSketch({ cells: sk({ 0: 'ocean' }), pct: 0 }, 16), null);
  assert.strictEqual(prepSketch({ cells: sk({ 0: 'ocean' }), pct: 101 }, 16), null);
  assert.strictEqual(prepSketch({ cells: sk({ 0: 'ocean' }), pct: '50' }, 16), null);
  const p = prepSketch({ cells: sk({ 0: 'ocean' }), pct: 50 }, 16);
  assert.strictEqual(p.cellCells, 30);   // 480 blocks / 16 blocks per cell
  assert.strictEqual(p.sub, 7);
  assert.strictEqual(p.variants.length, 1);
  assert.strictEqual(p.minScore, 0.5);
  // coarse grids keep at least one cell and one probe per zone
  const q = prepSketch({ cells: sk({ 0: 'ocean' }), pct: 50, rot: true, mir: true }, 2000);
  assert.strictEqual(q.cellCells, 1);
  assert.strictEqual(q.sub, 1);
  assert.strictEqual(q.variants.length, 8);
});

// synthetic grid where each grid cell is one sketch zone (SC = 480):
// plains everywhere, ocean along the column i=1
const SC = 480;
function oceanStripeGrid(cols, rows) {
  const grid = new Int32Array(cols * rows).fill(1);
  for (let j = 0; j < rows; j++) grid[j * cols + 1] = 0;
  return { grid, cols, rows };
}

test('dominantFamilies samples the 25 zones around a cell', () => {
  const g = oceanStripeGrid(7, 7);
  const fams = dominantFamilies(g, 3, 3, 1, 1);
  assert.strictEqual(fams.length, N);
  assert.strictEqual(fams[10], 'ocean');    // zone (u=0, v=2) -> column 1
  assert.strictEqual(fams[12], 'plains');   // center zone
  // zones outside the grid have no dominant family
  assert.strictEqual(dominantFamilies(g, 0, 0, 1, 1)[0], null);
  // a zone of family-less biomes has none either
  const mush = { grid: new Int32Array(49).fill(14), cols: 7, rows: 7 };
  assert.strictEqual(dominantFamilies(mush, 3, 3, 1, 1)[12], null);
  // the majority wins; ties keep the first family seen
  const maj = { grid: new Int32Array([0, 1, 1, 1]), cols: 2, rows: 2 };
  assert.strictEqual(dominantFamilies(maj, 1, 1, 2, 1)[12], 'plains');
  const tie = { grid: new Int32Array([0, 1]), cols: 2, rows: 1 };
  assert.strictEqual(dominantFamilies(tie, 1, 1, 2, 1)[12], 'ocean');
});

test('sketchPass matches the drawn layout at the right spots only', () => {
  const g = oceanStripeGrid(7, 7);
  const wanted = sk({ 10: 'ocean', 12: 'plains' });   // ocean west of the spot
  const prep = prepSketch({ cells: wanted, pct: 100 }, SC);
  assert.strictEqual(sketchPass(prep, g, 3, 3), true);
  assert.strictEqual(sketchPass(prep, g, 4, 3), false);
  // ocean drawn WEST but lying NORTH: only a rotation makes it match
  const gN = { grid: new Int32Array(49).fill(1), cols: 7, rows: 7 };
  for (let i = 0; i < 7; i++) gN.grid[1 * 7 + i] = 0;   // ocean row j=1
  const west = { cells: sk({ 10: 'ocean' }), pct: 100 };
  assert.strictEqual(sketchPass(prepSketch(west, SC), gN, 3, 3), false);
  assert.strictEqual(sketchPass(prepSketch({ ...west, rot: true }, SC), gN, 3, 3), true);
});

// ---- scanGrid integration ----
function params(g, extra) {
  return {
    ...g, gx0: 0, gz0: 0, SC,
    cx: Math.floor(g.cols * SC / 2), cz: Math.floor(g.rows * SC / 2),
    range: g.cols * SC, step: SC, mergeDist: 0,
    mainSet: new Set(),
    ...extra
  };
}

test('scanGrid: a sketch alone anchors the search', () => {
  const g = oceanStripeGrid(7, 7);
  const sketch = { cells: sk({ 10: 'ocean' }), pct: 100 };
  const hits = scanGrid(params(g, { sketch }));
  // only ci=3 puts the ocean stripe in the west zone
  assert.strictEqual(hits.length, 7);
  assert.ok(hits.every((h) => h.x === 3 * SC));
});

test('scanGrid: the sketch combines with the main-biome criterion', () => {
  const g = oceanStripeGrid(7, 7);
  const sketch = { cells: sk({ 10: 'ocean' }), pct: 100 };
  // main biome ocean: no spot is both on the stripe and east of it
  assert.strictEqual(scanGrid(params(g, { sketch, mainSet: new Set([0]) })).length, 0);
  assert.strictEqual(scanGrid(params(g, { sketch, mainSet: new Set([1]) })).length, 7);
});

test('scanGrid: a malformed sketch makes the request malformed', () => {
  const g = oceanStripeGrid(7, 7);
  assert.strictEqual(scanGrid(params(g, { sketch: { cells: sk(), pct: 100 } })), null);
  // and without any anchor at all the request stays rejected
  assert.strictEqual(scanGrid(params(g, {})), null);
});
