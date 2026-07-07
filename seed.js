// seed.js — converts the seed input string to a 64-bit world seed.
// Shared between worker.js (importScripts) and the Node test suite (require).
'use strict';

// Java String.hashCode, then sign-extended to 64 bits — matches Minecraft.
/**
 * @param {string|number|bigint} s seed input as typed by the user
 * @returns {bigint} signed 64-bit world seed
 */
function seedToBigInt(s) {
  s = String(s).trim();
  if (/^-?\d+$/.test(s)) return BigInt.asIntN(64, BigInt(s));
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    // Java hashes UTF-16 code units, so charCodeAt (not codePointAt) is
    // required for Minecraft parity. NOSONAR javascript:S7758
    h = Math.imul(31, h) + s.charCodeAt(i); // NOSONAR
    // explicit signed 32-bit overflow wrap, like Java int arithmetic
    if (h > 0x7FFFFFFF) h -= 0x100000000;
  }
  return BigInt(h); // signed 32-bit -> BigInt is already sign-correct
}

if (typeof module !== 'undefined' && module.exports) module.exports = { seedToBigInt };
