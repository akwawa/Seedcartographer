// Unit tests for view3d.js — pure geometry of the isometric terrain view
// (#325): adaptive sampling step, rotated painter's traversal, 2:1
// projection, canvas layout and face tints.
import test from 'node:test';
import assert from 'node:assert';
import {
  VIEW3D_MAX_CELLS, view3dSampleStep, view3dGrid, rotatedSize, rotatedIndex,
  isoProject, view3dLayout, shadeRgb, faceShades, cssRgb, heightSpan, heightNorm
} from '../view3d.js';

test('the sampling step adapts to the visible area size', () => {
  assert.strictEqual(view3dSampleStep(400, 400), 4);        // 100×100 at 1:4
  assert.strictEqual(view3dSampleStep(2048, 2048), 16);     // 1:4 would be 512×512
  assert.strictEqual(view3dSampleStep(8192, 8192), 64);
  assert.strictEqual(view3dSampleStep(32768, 32768), 256);  // exactly 128×128
  // beyond every scale the coarsest one is kept (the grid may exceed the
  // budget; the caller clamps the world rect long before this happens)
  assert.strictEqual(view3dSampleStep(1e7, 1e7), 256);
});

test('the sampled grid never exceeds the column budget at any scale', () => {
  for (const size of [100, 1000, 5000, 20000, 32768]) {
    const g = view3dGrid(-size / 2, -size / 2, size / 2, size / 2);
    assert.ok(g.cols * g.rows <= VIEW3D_MAX_CELLS + 2 * 128 + 1, `budget blown for ${size}`);
  }
});

test('view3dGrid covers the requested world rectangle', () => {
  const g = view3dGrid(-100, -50, 100, 50);
  assert.strictEqual(g.sc, 4);
  assert.strictEqual(g.ci0, -25);
  assert.strictEqual(g.cj0, -13);
  // the last cell contains the SE corner
  assert.ok((g.ci0 + g.cols - 1) * g.sc <= 100 && (g.ci0 + g.cols) * g.sc > 100);
  assert.ok((g.cj0 + g.rows - 1) * g.sc <= 50 && (g.cj0 + g.rows) * g.sc > 50);
});

test('quarter turns swap the rotated grid size', () => {
  assert.deepStrictEqual(rotatedSize(3, 2, 0), { cols: 3, rows: 2 });
  assert.deepStrictEqual(rotatedSize(3, 2, 1), { cols: 2, rows: 3 });
  assert.deepStrictEqual(rotatedSize(3, 2, 2), { cols: 3, rows: 2 });
  assert.deepStrictEqual(rotatedSize(3, 2, 3), { cols: 2, rows: 3 });
});

test('rotatedIndex is a bijection onto the grid for every rotation', () => {
  const cols = 3, rows = 2;
  for (const rot of [0, 1, 2, 3]) {
    const r = rotatedSize(cols, rows, rot);
    const seen = new Set();
    for (let v = 0; v < r.rows; v++) {
      for (let u = 0; u < r.cols; u++) {
        const n = rotatedIndex(u, v, cols, rows, rot);
        assert.ok(n >= 0 && n < cols * rows, `out of range at rot ${rot}`);
        seen.add(n);
      }
    }
    assert.strictEqual(seen.size, cols * rows, `not a bijection at rot ${rot}`);
  }
});

test('rotatedIndex maps the expected corners', () => {
  const cols = 3, rows = 2;             // indices 0..5, NW = 0, SE = 5
  assert.strictEqual(rotatedIndex(0, 0, cols, rows, 0), 0);
  assert.strictEqual(rotatedIndex(0, 0, cols, rows, 1), (rows - 1) * cols);   // SW becomes the back corner
  assert.strictEqual(rotatedIndex(0, 0, cols, rows, 2), cols * rows - 1);     // SE
  assert.strictEqual(rotatedIndex(0, 0, cols, rows, 3), cols - 1);            // NE
});

test('isoProject implements the classic 2:1 diamond projection', () => {
  const lay = { tile: 8, ox: 100, oy: 50 };
  assert.deepStrictEqual(isoProject(0, 0, 0, lay), { x: 100, y: 50 });
  assert.deepStrictEqual(isoProject(1, 0, 0, lay), { x: 104, y: 52 });
  assert.deepStrictEqual(isoProject(0, 1, 0, lay), { x: 96, y: 52 });
  // the lift raises the column straight up
  assert.deepStrictEqual(isoProject(1, 1, 10, lay), { x: 100, y: 44 });
});

test('the layout fits the grid and clamps the tile size', () => {
  const lay = view3dLayout(10, 10, 640, 100, 1);
  assert.strictEqual(lay.tile, 24);                    // clamped high
  assert.strictEqual(view3dLayout(1000, 1000, 640, 0, 1).tile, 2);   // clamped low
  assert.strictEqual(view3dLayout(64, 64, 640, 0, 1).tile, 10);      // fitted
  assert.strictEqual(lay.hUnit, 24 / 16);
  assert.strictEqual(lay.ox, 10 * 24 / 2);
  assert.strictEqual(lay.oy, 100 * lay.hUnit + 6);
  assert.strictEqual(lay.width, 240);
  // every projected point (with its faces) stays inside the canvas
  const top = isoProject(0, 0, 100 * lay.hUnit, lay);
  const bottom = isoProject(9, 9, 0, lay);
  assert.ok(top.y - lay.tile / 4 >= 0);
  assert.ok(bottom.y + lay.tile / 4 + lay.tile / 4 <= lay.height);
});

test('shadeRgb multiplies and clamps to the byte range', () => {
  assert.deepStrictEqual(shadeRgb([100, 50, 0], 1.5), [150, 75, 0]);
  assert.deepStrictEqual(shadeRgb([200, 200, 200], 2), [255, 255, 255]);
  assert.deepStrictEqual(shadeRgb([10, 10, 10], -1), [0, 0, 0]);
});

test('face tints brighten the top with altitude and darken the sides', () => {
  const low = faceShades([100, 100, 100], 0);
  assert.deepStrictEqual(low.top, [100, 100, 100]);
  const high = faceShades([100, 100, 100], 1);
  assert.strictEqual(high.top[0], 125);
  assert.ok(low.left[0] < 100 && low.right[0] < low.left[0]);
});

test('cssRgb formats a triplet', () => {
  assert.strictEqual(cssRgb([1, 2, 3]), 'rgb(1,2,3)');
});

test('heightSpan finds the range, safe on empty and flat grids', () => {
  assert.deepStrictEqual(heightSpan([]), { min: 0, span: 0 });
  assert.deepStrictEqual(heightSpan([64]), { min: 64, span: 0 });
  assert.deepStrictEqual(heightSpan([80, 62, 100, 70]), { min: 62, span: 38 });
});

test('heightNorm normalizes to 0..1 and never divides by zero', () => {
  const range = { min: 60, span: 40 };
  assert.strictEqual(heightNorm(60, range), 0);
  assert.strictEqual(heightNorm(100, range), 1);
  assert.strictEqual(heightNorm(80, range), 0.5);
  assert.strictEqual(heightNorm(64, { min: 64, span: 0 }), 0);
});
