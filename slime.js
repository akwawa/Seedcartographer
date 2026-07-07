// slime.js — slime-chunk math, straight from the seed (Java RNG), no cubiomes
// involved. Shared between worker.js (importScripts), app.js (script tag,
// for the SLIME_STRUCT_TYPE constant) and the Node test suite (require).
'use strict';

// synthetic "structure" type routed to this module instead of the WASM engine
// by worker.js; must never collide with a cubiomes StructureType enum value
const SLIME_STRUCT_TYPE = -2;

// java.util.Random LCG constants (48-bit state)
const JAVA_LCG_MULT = 0x5DEECE66Dn;
const JAVA_LCG_ADD = 0xBn;
const JAVA_LCG_MASK = (1n << 48n) - 1n;

// Minecraft's isSlimeChunk: seed the Java RNG with a per-chunk value derived
// from the world seed, then test nextInt(10) == 0. The x/z products deliberately
// overflow 32-bit ints before widening to long, hence Math.imul.
/**
 * @param {bigint} worldSeed signed 64-bit world seed
 * @param {number} chunkX chunk coordinate X
 * @param {number} chunkZ chunk coordinate Z
 * @returns {boolean}
 */
function isSlimeChunk(worldSeed, chunkX, chunkZ) {
  const mix = BigInt.asIntN(64,
    (worldSeed
      + BigInt(Math.imul(Math.imul(chunkX, chunkX), 0x4c1906))
      + BigInt(Math.imul(chunkX, 0x5ac0db))
      + BigInt(Math.imul(chunkZ, chunkZ)) * 0x4307a7n
      + BigInt(Math.imul(chunkZ, 0x5f24f))
    ) ^ 0x3ad8025fn);
  let state = (mix ^ JAVA_LCG_MULT) & JAVA_LCG_MASK;
  // Random.nextInt(10), including its modulo-bias rejection loop: Java
  // rejects the draw when `bits - val + 9` overflows a 32-bit int
  for (;;) {
    state = (state * JAVA_LCG_MULT + JAVA_LCG_ADD) & JAVA_LCG_MASK;
    const bits = Number(state >> 17n);
    const val = bits % 10;
    if (bits - val + 9 <= 0x7FFFFFFF) return val === 0;
  }
}

// All slime chunks whose chunk intersects the block box [x0,z0]-[x1,z1],
// as [chunkX, chunkZ] pairs, capped at `max` entries.
/**
 * @param {bigint} worldSeed signed 64-bit world seed
 * @param {number} x0 west block edge
 * @param {number} z0 north block edge
 * @param {number} x1 east block edge
 * @param {number} z1 south block edge
 * @param {number} max cap on the number of returned chunks
 * @returns {Array<[number, number]>} [chunkX, chunkZ] pairs
 */
function slimeChunksInBox(worldSeed, x0, z0, x1, z1, max) {
  const ci0 = Math.floor(x0 / 16), ci1 = Math.floor(x1 / 16);
  const cj0 = Math.floor(z0 / 16), cj1 = Math.floor(z1 / 16);
  /** @type {Array<[number, number]>} */
  const out = [];
  for (let cj = cj0; cj <= cj1; cj++) {
    for (let ci = ci0; ci <= ci1; ci++) {
      if (!isSlimeChunk(worldSeed, ci, cj)) continue;
      out.push([ci, cj]);
      if (out.length >= max) return out;
    }
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isSlimeChunk, slimeChunksInBox, SLIME_STRUCT_TYPE };
}
