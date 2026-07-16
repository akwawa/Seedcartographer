import test from 'node:test';
import assert from 'node:assert';
import { reliefSampleStep, hillshade, upsampleShade, RELIEF_MIN, RELIEF_MAX } from '../relief.js';

test('reliefSampleStep is finer at close zoom, coarser far out', () => {
  assert.strictEqual(reliefSampleStep(4), 4);
  assert.strictEqual(reliefSampleStep(16), 4);
  assert.strictEqual(reliefSampleStep(64), 8);
  assert.strictEqual(reliefSampleStep(256), 8);
});

test('hillshade: flat ground shades to exactly 1', () => {
  const shade = hillshade(new Float64Array(9).fill(64), 3, 3, 16);
  for (const s of shade) assert.strictEqual(s, 1);
});

test('hillshade: NW-facing slopes brighten, SE-facing slopes darken', () => {
  // heights rise toward the south-east -> ground faces NW -> lit
  const rising = [0, 1, 2, 1, 2, 3, 2, 3, 4].map((h) => h * 16);
  const lit = hillshade(rising, 3, 3, 16);
  assert.ok(lit[4] > 1, `center of a NW-facing slope should be lit, got ${lit[4]}`);
  // heights fall toward the south-east -> ground faces SE -> in shadow
  const falling = rising.map((h) => -h);
  const dark = hillshade(falling, 3, 3, 16);
  assert.ok(dark[4] < 1, `center of a SE-facing slope should be dark, got ${dark[4]}`);
});

test('hillshade: extreme slopes clamp to the min/max swing', () => {
  const cliffUp = [0, 1000, 2000, 1000, 2000, 3000, 2000, 3000, 4000];
  // Float32Array storage: compare within float precision
  assert.ok(Math.abs(hillshade(cliffUp, 3, 3, 4)[4] - RELIEF_MAX) < 1e-6);
  const cliffDown = cliffUp.map((h) => -h);
  assert.ok(Math.abs(hillshade(cliffDown, 3, 3, 4)[4] - RELIEF_MIN) < 1e-6);
});

test('hillshade: single-sample grid stays flat (degenerate differences)', () => {
  const shade = hillshade([80], 1, 1, 16);
  assert.strictEqual(shade.length, 1);
  assert.strictEqual(shade[0], 1);
});

test('hillshade: borders use one-sided differences', () => {
  // a single ridge column: both borders still get a finite, clamped shade
  const shade = hillshade([0, 160, 0, 0, 160, 0, 0, 160, 0], 3, 3, 16);
  for (const s of shade) {
    assert.ok(s >= RELIEF_MIN && s <= RELIEF_MAX);
  }
  assert.ok(shade[3] > 1, 'west of the ridge faces NW: lit');
  assert.ok(shade[5] < 1, 'east of the ridge faces SE: dark');
});

test('upsampleShade: constant grid upsamples to the constant', () => {
  const out = upsampleShade(new Float32Array(4).fill(0.8), 2, 2, 4, 8, 8);
  assert.strictEqual(out.length, 64);
  for (const v of out) assert.ok(Math.abs(v - 0.8) < 1e-6);
});

test('upsampleShade: interpolates between samples and clamps at borders', () => {
  // 2x1 samples: left 1.0, right 2.0, step 4 over 8 cells
  const out = upsampleShade([1, 2], 2, 1, 4, 8, 1);
  assert.strictEqual(out[0], 1);              // clamped before the first sample
  assert.strictEqual(out[7], 2);              // clamped past the last sample
  assert.ok(out[3] > out[2] && out[4] > out[3], 'monotone rise between samples');
  assert.ok(Math.abs(out[4] - 1.5) < 0.13, `midpoint near 1.5, got ${out[4]}`);
});

test('upsampleShade: single sample fills the whole tile', () => {
  const out = upsampleShade([1.2], 1, 1, 8, 4, 4);
  for (const v of out) assert.ok(Math.abs(v - 1.2) < 1e-6);
});
