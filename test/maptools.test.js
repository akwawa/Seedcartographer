'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
  scaleBarSpec, gridSpec, gridLines, MINIMAP_ZOOM_OUT,
  minimapClickToWorld, viewportRectOnMinimap
} = require('../maptools.js');

test('scaleBarSpec picks the longest 1/2/5×10^n length that fits', () => {
  assert.deepStrictEqual(scaleBarSpec(2.2, 140), { blocks: 200, px: 200 / 2.2 });
  assert.deepStrictEqual(scaleBarSpec(1, 140), { blocks: 100, px: 100 });
  assert.deepStrictEqual(scaleBarSpec(512, 140), { blocks: 50000, px: 50000 / 512 });
  // the bar never exceeds the pixel budget and never vanishes
  for (const bpp of [0.5, 1, 2.2, 7, 33, 512]) {
    const { blocks, px } = scaleBarSpec(bpp);
    assert.ok(px <= 140, `bpp ${bpp}: ${px}px`);
    assert.ok(blocks >= 1);
  }
});

test('gridSpec steps from chunks to coarser grids as the view zooms out', () => {
  assert.deepStrictEqual(gridSpec(0.5), { step: 16, kind: 'chunk' });
  assert.deepStrictEqual(gridSpec(2.2), { step: 128, kind: 'octochunk' });
  assert.deepStrictEqual(gridSpec(10), { step: 512, kind: 'region' });
  assert.deepStrictEqual(gridSpec(80), { step: 4096, kind: 'coarse' });
  // even far beyond the last threshold a spacing is returned
  assert.strictEqual(gridSpec(1e6).step, 262144);
  // lines are never closer than the readability floor
  for (const bpp of [0.5, 1, 2.2, 10, 100, 512]) {
    assert.ok(gridSpec(bpp).step / bpp >= 24 || gridSpec(bpp).step === 262144);
  }
});

test('gridLines returns the multiples of step inside the range', () => {
  assert.deepStrictEqual(gridLines(-100, 100, 50), [-100, -50, 0, 50, 100]);
  assert.deepStrictEqual(gridLines(1, 99, 50), [50]);
  assert.deepStrictEqual(gridLines(60, 99, 50), []);
  assert.deepStrictEqual(gridLines(-512, -1, 512), [-512]);
});

test('minimap click maps back to world coordinates around the shared center', () => {
  const view = { cx: 1000, cz: -2000, bpp: 2 };
  // center click -> view center
  assert.deepStrictEqual(minimapClickToWorld(88, 66, 176, 132, view), { x: 1000, z: -2000 });
  // one minimap pixel is bpp × MINIMAP_ZOOM_OUT blocks
  const p = minimapClickToWorld(89, 66, 176, 132, view);
  assert.strictEqual(p.x, 1000 + 2 * MINIMAP_ZOOM_OUT);
  assert.strictEqual(p.z, -2000);
});

test('the viewport rectangle is centered and scaled by the zoom-out factor', () => {
  const r = viewportRectOnMinimap(800, 600, 176, 132);
  assert.deepStrictEqual(r, { x: 88 - 50, y: 66 - 37.5, w: 100, h: 75 });
});
