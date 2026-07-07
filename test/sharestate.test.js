'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
  encodeShareState, decodeShareState, normalizeLegacyCriteria,
  sanitizeCriteria, sanitizeWorldView, worldToScreen, screenToWorld
} = require('../sharestate.js');

test('share state round-trips through the hash encoding', () => {
  const state = { s: '141', m: 28, l: 0, d: 0, y: 60, x: -392, z: 56, b: 2.2, c: { mb: [185] } };
  const encoded = encodeShareState(state);
  assert.match(encoded, /^[A-Za-z0-9+/=]+$/);   // URL-hash-safe base64
  assert.deepStrictEqual(decodeShareState(encoded), state);
});

test('malformed hashes decode to null instead of throwing', () => {
  assert.strictEqual(decodeShareState('not base64 !!!'), null);
  // valid base64 wrapping invalid JSON
  assert.strictEqual(decodeShareState(Buffer.from('{oops', 'binary').toString('base64')), null);
  assert.strictEqual(decodeShareState(''), null);
});

test('legacy single-criteria links are migrated, modern ones untouched', () => {
  const legacy = normalizeLegacyCriteria({ a: 185, ba: 44, ad: 400, st: 7, mn: 2, sr: 800, rg: 5000, sp: 16 });
  assert.deepStrictEqual(legacy, {
    mb: [185], am: 'and', ac: [{ b: 44, d: 400 }], sm: 'and',
    sc: [{ t: 7, mn: 2, r: 800 }], rg: 5000, sp: 16
  });
  // legacy link without the optional clauses
  assert.deepStrictEqual(normalizeLegacyCriteria({ a: 14 }).ac, []);
  const modern = { mb: [1], am: 'or', ac: [], sm: 'and', sc: [] };
  assert.strictEqual(normalizeLegacyCriteria(modern), modern);
  assert.strictEqual(normalizeLegacyCriteria(null), null);
});

test('sanitizeCriteria coerces integers, drops junk and caps row counts', () => {
  const c = sanitizeCriteria({
    mb: ['<img>', 185, '44'],
    am: 'evil', ac: [{ b: 'x', d: 'y' }, { b: 44, d: 400, n: 1 }, { b: 44, d: -1 }],
    sm: 'or', sc: [{ t: 7, mn: 2, r: 800 }, 'nope', { t: 7, mn: -1, r: 800 }],
    rg: 'zz', sp: 16, s0: '60', s1: null
  }, 8);
  assert.deepStrictEqual(c, {
    mb: [185, 44], am: 'and',
    ac: [{ b: 44, d: 400, n: true }],
    sm: 'or', sc: [{ t: 7, mn: 2, r: 800 }],
    rg: null, sp: 16, s0: 60, s1: null
  });
  // caps every list
  const many = sanitizeCriteria({ mb: Array.from({ length: 20 }, (_, i) => i) }, 8);
  assert.strictEqual(many.mb.length, 8);
  assert.strictEqual(sanitizeCriteria(null, 8), null);
  assert.strictEqual(sanitizeCriteria('str', 8), null);
});

test('sanitizeWorldView bounds-checks every hash field', () => {
  const wv = sanitizeWorldView({ s: 141, m: 'evil', l: 1, d: 7, y: 9999, x: 10, z: -20, b: 99999 });
  assert.deepStrictEqual(wv, { seed: '141', mc: null, large: true, dim: 0, y: 320, cx: 10, cz: -20, bpp: 512 });
  const ok = sanitizeWorldView({ s: 'abc', m: 28, l: 0, d: -1, y: -100, x: 0, z: 0, b: 2.2 });
  assert.deepStrictEqual(ok, { seed: 'abc', mc: 28, large: false, dim: -1, y: -64, cx: 0, cz: 0, bpp: 2.2 });
  assert.strictEqual(sanitizeWorldView(null), null);
  // a seed of a weird type falls back to '0'
  assert.strictEqual(sanitizeWorldView({ s: { evil: 1 } }).seed, '0');
});

test('world and screen transforms are exact inverses around the view center', () => {
  const view = { cx: 1000, cz: -500, bpp: 2 };
  assert.deepStrictEqual(worldToScreen(view, 800, 600, 1000, -500), { x: 400, y: 300 });
  assert.deepStrictEqual(screenToWorld(view, 800, 600, 400, 300), { x: 1000, z: -500 });
  const s = worldToScreen(view, 800, 600, 1234, -321);
  const w = screenToWorld(view, 800, 600, s.x, s.y);
  assert.deepStrictEqual(w, { x: 1234, z: -321 });
});
