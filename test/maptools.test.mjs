import { test } from 'node:test';
import assert from 'node:assert';
import {
  scaleBarSpec, gridSpec, gridLines, MINIMAP_ZOOM_OUT,
  minimapClickToWorld, viewportRectOnMinimap, minimapZoomOut, parseGotoInput, GOTO_LIMIT, rulerMeasure, linkedGridSpec, normalizeRect, formatRect
} from '../maptools.js';

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

test('parseGotoInput accepts two integers with common separators', () => {
  assert.deepStrictEqual(parseGotoInput('100, -250'), { x: 100, z: -250 });
  assert.deepStrictEqual(parseGotoInput('  -3;7  '), { x: -3, z: 7 });
  assert.deepStrictEqual(parseGotoInput('0 0'), { x: 0, z: 0 });
  assert.deepStrictEqual(parseGotoInput('12\t34'), { x: 12, z: 34 });
});

test('parseGotoInput rejects malformed or out-of-world input', () => {
  assert.strictEqual(parseGotoInput(''), null);
  assert.strictEqual(parseGotoInput('abc'), null);
  assert.strictEqual(parseGotoInput('100'), null);
  assert.strictEqual(parseGotoInput('1, 2, 3'), null);
  assert.strictEqual(parseGotoInput('1.5, 2'), null);
  assert.strictEqual(parseGotoInput(`0, ${GOTO_LIMIT + 1}`), null);
  assert.strictEqual(parseGotoInput(`-${GOTO_LIMIT + 1}, 0`), null);
  // the border itself is still reachable
  assert.deepStrictEqual(parseGotoInput(`${GOTO_LIMIT}, 0`), { x: GOTO_LIMIT, z: 0 });
});

test('rulerMeasure returns the euclidean distance and per-axis deltas', () => {
  assert.deepStrictEqual(rulerMeasure({ x: 0, z: 0 }, { x: 3, z: 4 }), { dist: 5, dx: 3, dz: 4 });
  assert.deepStrictEqual(rulerMeasure({ x: 10, z: -5 }, { x: 10, z: -5 }), { dist: 0, dx: 0, dz: 0 });
  // symmetric and sign-insensitive
  assert.deepStrictEqual(rulerMeasure({ x: 3, z: 4 }, { x: 0, z: 0 }), { dist: 5, dx: 3, dz: 4 });
  // non-integer distances are rounded to whole blocks
  assert.strictEqual(rulerMeasure({ x: 0, z: 0 }, { x: 1, z: 1 }).dist, 1);
});

test('parseGotoInput tolerates null and undefined input', () => {
  assert.strictEqual(parseGotoInput(null), null);
  assert.strictEqual(parseGotoInput(undefined), null);
});

test('linkedGridSpec maps nice Nether steps onto Overworld blocks and back', () => {
  // Overworld at bpp 2: linked (Nether) zoom is 0.25 bpp -> 16-block Nether
  // chunks are readable, drawn every 128 Overworld blocks
  const ow = linkedGridSpec(0, 2);
  assert.strictEqual(ow.factor, 8);
  assert.strictEqual(ow.label, 'Nether');
  assert.strictEqual(ow.currentStep / ow.factor % 16, 0);   // nice Nether step
  assert.ok(ow.currentStep / 2 >= 48);                       // readable spacing
  // Nether at the same zoom: Overworld steps are 8x coarser in blocks but
  // 8x denser on this map
  const ne = linkedGridSpec(-1, 2);
  assert.strictEqual(ne.factor, 1 / 8);
  assert.strictEqual(ne.label, 'Overworld');
  assert.ok(ne.currentStep / 2 >= 48);
  // the End has no linked dimension
  assert.strictEqual(linkedGridSpec(1, 2), null);
});

test('normalizeRect orders the corners and counts inclusive block spans', () => {
  const r = normalizeRect({ x: 100, z: -50 }, { x: -20, z: 30 });
  assert.deepStrictEqual(r, { x0: -20, z0: -50, x1: 100, z1: 30, w: 121, h: 81 });
  // degenerate one-block selection
  assert.deepStrictEqual(normalizeRect({ x: 5, z: 5 }, { x: 5, z: 5 }),
    { x0: 5, z0: 5, x1: 5, z1: 5, w: 1, h: 1 });
});

test('formatRect renders the copyable coordinate summary', () => {
  assert.strictEqual(formatRect(normalizeRect({ x: 0, z: 0 }, { x: 9, z: 4 })),
    '0, 0 -> 9, 4 (10 x 5)');
});

test('minimapZoomOut shrinks the overview factor past the engine cell cap', () => {
  assert.strictEqual(minimapZoomOut(4), MINIMAP_ZOOM_OUT);   // normal zooms: full 8x
  assert.strictEqual(minimapZoomOut(32), MINIMAP_ZOOM_OUT);  // 32*8 = 256, still 1 cell/px
  assert.strictEqual(minimapZoomOut(64), 4);                 // capped: 256/64
  assert.strictEqual(minimapZoomOut(512), 1);                // never below 1x
});

test('minimap helpers honor the effective zoom-out factor', () => {
  // at bpp 512 the factor is 1: a minimap click maps 1 block per pixel step
  const view = { cx: 0, cz: 0, bpp: 512 };
  assert.deepStrictEqual(minimapClickToWorld(89, 66, 176, 132, view), { x: 512, z: 0 });
  // and the viewport rectangle covers the whole minimap width instead of 1/8
  const r = viewportRectOnMinimap(176, 132, 176, 132, 1);
  assert.deepStrictEqual(r, { x: 0, y: 0, w: 176, h: 132 });
});
