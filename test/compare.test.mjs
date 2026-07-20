import test from 'node:test';
import assert from 'node:assert';
import {
  COMPARE_MIN_BPP, COMPARE_MAX_BPP, clampBpp, panViewport, zoomViewportAt,
  sameViewport, normalizeCompareSeed, compareWorldFor,
  createCompareState, enterCompare, exitCompare,
  STRUCT_QUERY_MARGIN_PX, structQueryRect, structuresRequestFor
} from '../compare.js';

test('clampBpp bounds the zoom to the supported range', () => {
  assert.strictEqual(clampBpp(0.01), COMPARE_MIN_BPP);
  assert.strictEqual(clampBpp(10000), COMPARE_MAX_BPP);
  assert.strictEqual(clampBpp(2.5), 2.5);
});

test('panViewport shifts the center opposite to the pointer, scaled by bpp', () => {
  const v = { cx: 100, cz: -50, bpp: 2 };
  assert.deepStrictEqual(panViewport(v, 10, -5), { cx: 80, cz: -40, bpp: 2 });
  // zero drag is a no-op and never mutates the input
  assert.deepStrictEqual(panViewport(v, 0, 0), v);
  assert.deepStrictEqual(v, { cx: 100, cz: -50, bpp: 2 });
});

test('zoomViewportAt keeps the world point under the anchor fixed', () => {
  const v = { cx: 0, cz: 0, bpp: 2 };
  const w = 400, h = 300, mx = 300, my = 50;
  const wx = v.cx + (mx - w / 2) * v.bpp;
  const wz = v.cz + (my - h / 2) * v.bpp;
  const out = zoomViewportAt(v, w, h, mx, my, 0.5);
  assert.strictEqual(out.bpp, 1);
  assert.strictEqual(out.cx + (mx - w / 2) * out.bpp, wx);
  assert.strictEqual(out.cz + (my - h / 2) * out.bpp, wz);
});

test('zoomViewportAt at the exact center only changes the scale', () => {
  const out = zoomViewportAt({ cx: 64, cz: -32, bpp: 4 }, 200, 100, 100, 50, 2);
  assert.deepStrictEqual(out, { cx: 64, cz: -32, bpp: 8 });
});

test('zoomViewportAt clamps the resulting zoom', () => {
  assert.strictEqual(zoomViewportAt({ cx: 0, cz: 0, bpp: 1 }, 10, 10, 5, 5, 1e-9).bpp, COMPARE_MIN_BPP);
  assert.strictEqual(zoomViewportAt({ cx: 0, cz: 0, bpp: 1 }, 10, 10, 5, 5, 1e9).bpp, COMPARE_MAX_BPP);
});

test('sameViewport compares center and zoom', () => {
  assert.strictEqual(sameViewport({ cx: 1, cz: 2, bpp: 3 }, { cx: 1, cz: 2, bpp: 3 }), true);
  assert.strictEqual(sameViewport({ cx: 1, cz: 2, bpp: 3 }, { cx: 0, cz: 2, bpp: 3 }), false);
  assert.strictEqual(sameViewport({ cx: 1, cz: 2, bpp: 3 }, { cx: 1, cz: 0, bpp: 3 }), false);
  assert.strictEqual(sameViewport({ cx: 1, cz: 2, bpp: 3 }, { cx: 1, cz: 2, bpp: 4 }), false);
});

test('normalizeCompareSeed trims and falls back to the main seed', () => {
  assert.strictEqual(normalizeCompareSeed('  4242 ', '141'), '4242');
  assert.strictEqual(normalizeCompareSeed(-7, '141'), '-7');
  assert.strictEqual(normalizeCompareSeed('', '141'), '141');
  assert.strictEqual(normalizeCompareSeed('   ', 141), '141');
  assert.strictEqual(normalizeCompareSeed(null, '141'), '141');
});

test('normalizeCompareSeed never returns an empty seed', () => {
  assert.strictEqual(normalizeCompareSeed('', ''), '0');
  assert.strictEqual(normalizeCompareSeed(undefined, '  '), '0');
  assert.strictEqual(normalizeCompareSeed('', null), '0');
});

test('compareWorldFor keeps version, size and dimension but swaps the seed', () => {
  const world = { seed: '141', mc: 28, large: true, dim: -1 };
  assert.deepStrictEqual(compareWorldFor(world, '4242'),
    { seed: '4242', mc: 28, large: true, dim: -1 });
  // the main world is untouched
  assert.strictEqual(world.seed, '141');
});

test('compare-mode state transitions', () => {
  const s0 = createCompareState();
  assert.deepStrictEqual(s0, { on: false, seed: '' });
  const s1 = enterCompare(s0, ' 99 ', '141');
  assert.deepStrictEqual(s1, { on: true, seed: '99' });
  const s2 = enterCompare(s0, '', '141');
  assert.deepStrictEqual(s2, { on: true, seed: '141' });
  const s3 = exitCompare(s1);
  assert.deepStrictEqual(s3, { on: false, seed: '99' });   // seed kept for re-entry
  assert.strictEqual(s1.on, true);                          // inputs never mutated
});

test('structQueryRect covers the view plus the off-screen margin, in blocks', () => {
  const view = { cx: 100, cz: -50, bpp: 2 };
  const r = structQueryRect(view, 400, 300);
  assert.deepStrictEqual(r, {
    x0: 100 - (200 + STRUCT_QUERY_MARGIN_PX) * 2, z0: -50 - (150 + STRUCT_QUERY_MARGIN_PX) * 2,
    x1: 100 + (200 + STRUCT_QUERY_MARGIN_PX) * 2, z1: -50 + (150 + STRUCT_QUERY_MARGIN_PX) * 2
  });
  // the viewport is never mutated
  assert.deepStrictEqual(view, { cx: 100, cz: -50, bpp: 2 });
});

test('structQueryRect rounds outward to whole blocks', () => {
  const r = structQueryRect({ cx: 0.4, cz: -0.4, bpp: 1 }, 11, 7);
  assert.deepStrictEqual(r, { x0: -206, z0: -204, x1: 206, z1: 204 });
});

test('structuresRequestFor builds the worker listing message for a pane', () => {
  const world = { seed: '4242', mc: 28, large: true, dim: -1 };
  const rect = { x0: -10, z0: -20, x1: 30, z1: 40 };
  assert.deepStrictEqual(structuresRequestFor(7, world, [3, 'slime'], rect), {
    type: 'structures', reqId: 7, seed: '4242', mc: 28, large: true, dim: -1,
    types: [3, 'slime'], x0: -10, z0: -20, x1: 30, z1: 40
  });
});
