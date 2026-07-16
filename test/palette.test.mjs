import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { test } from 'node:test';
import assert from 'node:assert';
const { OKABE_ITO, altRgb, altBiomeColors } = require('../palette.js');

test('altRgb shades a safe hue by the base luminance', () => {
  // black stays dark but never fully black (hue must stay readable)
  const dark = altRgb(0, [0, 0, 0]);
  const bright = altRgb(0, [255, 255, 255]);
  assert.deepStrictEqual(bright, OKABE_ITO[0]);
  for (let i = 0; i < 3; i++) {
    assert.ok(dark[i] <= bright[i]);
    assert.strictEqual(dark[i], Math.round(OKABE_ITO[0][i] * 0.3));
  }
});

test('adjacent biome ids get different hues', () => {
  const base = [128, 128, 128];
  for (let id = 0; id < 16; id++) {
    assert.notDeepStrictEqual(altRgb(id, base), altRgb(id + 1, base));
  }
});

test('altBiomeColors remaps the whole 256-entry table deterministically', () => {
  const baseTable = new Uint8Array(256 * 3);
  for (let i = 0; i < baseTable.length; i++) baseTable[i] = (i * 37) % 256;
  const a = altBiomeColors(baseTable);
  const b = altBiomeColors(baseTable);
  assert.strictEqual(a.length, 256 * 3);
  assert.deepStrictEqual([...a], [...b]);
  // every entry matches the per-biome function
  for (const id of [0, 7, 8, 141, 255]) {
    const rgb = altRgb(id, [baseTable[id * 3], baseTable[id * 3 + 1], baseTable[id * 3 + 2]]);
    assert.deepStrictEqual([a[id * 3], a[id * 3 + 1], a[id * 3 + 2]], rgb);
  }
});
