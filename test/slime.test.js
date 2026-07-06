'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { isSlimeChunk, slimeChunksInBox, SLIME_STRUCT_TYPE } = require('../slime.js');

// fixtures cross-checked against an independent Java-Random implementation
test('known slime chunks for seed 141', () => {
  assert.strictEqual(isSlimeChunk(141n, -3, -5), true);
  assert.strictEqual(isSlimeChunk(141n, -1, -4), true);
  assert.strictEqual(isSlimeChunk(141n, 6, 0), true);
  assert.strictEqual(isSlimeChunk(141n, 0, 0), false);
  assert.strictEqual(isSlimeChunk(141n, 1, 0), false);
  assert.strictEqual(isSlimeChunk(141n, 7, -2), false);
});

test('the 32-bit overflow of the chunk mixing survives large seeds and coordinates', () => {
  assert.strictEqual(isSlimeChunk(-7799461267186613798n, 12, -34), false);
  assert.strictEqual(isSlimeChunk(-7799461267186613798n, -3, 7), false);
  // far-out coordinates overflow x*x / z*z as Java ints; must not throw
  assert.strictEqual(typeof isSlimeChunk(0n, 1875000, -1875000), 'boolean');
});

test('slime chunk density is about 1 in 10', () => {
  let n = 0;
  for (let z = 0; z < 100; z++) {
    for (let x = 0; x < 100; x++) if (isSlimeChunk(141n, x, z)) n++;
  }
  assert.strictEqual(n, 992); // deterministic for seed 141; ~9.9%
});

test('slimeChunksInBox lists chunks intersecting a block box', () => {
  const chunks = slimeChunksInBox(141n, -100, -100, 100, 100, 1000);
  assert.deepStrictEqual(chunks.slice(0, 3), [[-3, -5], [-1, -4], [6, -4]]);
  assert.strictEqual(chunks.length, 17);
  for (const [cx, cz] of chunks) assert.strictEqual(isSlimeChunk(141n, cx, cz), true);
});

test('slimeChunksInBox honours the max cap', () => {
  assert.strictEqual(slimeChunksInBox(141n, -100, -100, 100, 100, 5).length, 5);
});

test('the synthetic structure type stays clear of real engine ids', () => {
  assert.strictEqual(SLIME_STRUCT_TYPE, -2);
});
