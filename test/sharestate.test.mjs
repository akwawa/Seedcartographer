import { test } from 'node:test';
import assert from 'node:assert';
import {
  encodeShareState, decodeShareState, encodeShareHash, decodeShareHash, normalizeLegacyCriteria,
  sanitizeCriteria, sanitizeWorldView, worldToScreen, screenToWorld
} from '../sharestate.js';

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
    ac: [{ b: 44, d: 400, n: true, yl: null }],
    qm: 'and', qc: [],
    hm: 'and', hc: [],
    sm: 'or', sc: [{ t: 7, mn: 2, r: 800, im: false }], pc: [],
    rg: null, sp: 16, s0: 60, s1: null
  });
  // structure pairs: junk dropped, flags coerced
  const p = sanitizeCriteria({ mb: [1], pc: [{ t1: 3, t2: 4, g: 300, r: 800 }, { t1: 'x' }, { t1: 1, t2: 2, g: -5, r: 10 }],
    sc: [{ t: 7, mn: 1, r: 500, im: 1 }] }, 8);
  assert.deepStrictEqual(p.pc, [{ t1: 3, t2: 4, g: 300, r: 800 }]);
  assert.strictEqual(p.sc[0].im, true);
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

test('sanitizeCriteria keeps the explicit or-modes', () => {
  const c = sanitizeCriteria({ mb: [1], am: 'or', ac: [], sm: 'or', sc: [], pc: [] }, 8);
  assert.strictEqual(c.am, 'or');
  assert.strictEqual(c.sm, 'or');
});

test('encodeShareHash produces a compressed hash that decodeShareHash round-trips', async () => {
  const state = { s: '141', m: 22, l: 0, d: 0, y: 60, x: 0, z: 0, b: 4, c: { mb: [5, 6, 7], ac: [{ b: 44, d: 300 }] } };
  const hash = await encodeShareHash(state);
  assert.ok(hash.startsWith('z.'), 'compressed hashes carry the z. prefix');
  assert.deepStrictEqual(await decodeShareHash(hash), state);
  // the point of the ticket: shorter links than the legacy encoding
  assert.ok(hash.length < encodeShareState(state).length);
});

test('decodeShareHash still reads legacy uncompressed hashes', async () => {
  const state = { s: 'legacy', m: 21, c: { mb: [1] } };
  assert.deepStrictEqual(await decodeShareHash(encodeShareState(state)), state);
});

test('decodeShareHash rejects malformed compressed payloads', async () => {
  assert.strictEqual(await decodeShareHash('z.not-valid-deflate!!'), null);
  assert.strictEqual(await decodeShareHash('z.'), null);
  assert.strictEqual(await decodeShareHash(null), null);
});

test('the codec degrades to the legacy format without CompressionStream', async (t) => {
  const CS = globalThis.CompressionStream, DS = globalThis.DecompressionStream;
  t.after(() => { globalThis.CompressionStream = CS; globalThis.DecompressionStream = DS; });
  globalThis.CompressionStream = undefined;
  globalThis.DecompressionStream = undefined;
  const state = { s: '141', m: 22 };
  const hash = await encodeShareHash(state);
  assert.ok(!hash.startsWith('z.'), 'fallback links use the legacy format');
  assert.deepStrictEqual(await decodeShareHash(hash), state);
  // a compressed link cannot be read on such a runtime: null, not a throw
  assert.strictEqual(await decodeShareHash('z.abc'), null);
});

test('sanitizeCriteria keeps well-formed percentage clauses and drops the rest', () => {
  const c = sanitizeCriteria({
    mb: [1], qm: 'or',
    qc: [
      { b: 5, p: 30, d: 400 },          // valid
      { b: 5, p: 0, d: 400 },           // pct out of range
      { b: 5, p: 101, d: 400 },         // pct out of range
      { b: 5, p: 30, d: 0 },            // no radius
      { b: 'x', p: 30, d: 400 },        // malformed biome
      'junk'
    ]
  }, 10);
  assert.strictEqual(c.qm, 'or');
  assert.deepStrictEqual(c.qc, [{ b: 5, p: 30, d: 400 }]);
  // defaults: AND mode and empty list when absent
  const d = sanitizeCriteria({ mb: [1] }, 10);
  assert.strictEqual(d.qm, 'and');
  assert.deepStrictEqual(d.qc, []);
});

test('sanitizeCriteria clamps the optional per-clause altitude', () => {
  const c = sanitizeCriteria({
    mb: [1],
    ac: [
      { b: 5, d: 400, yl: -40 },
      { b: 5, d: 400, yl: 999 },
      { b: 5, d: 400, yl: 'x' },
      { b: 5, d: 400 }
    ]
  }, 8);
  assert.deepStrictEqual(c.ac.map((r) => r.yl), [-40, 320, null, null]);
});

test('sanitizeCriteria validates shape clauses (hc/hm)', () => {
  const c = sanitizeCriteria({
    mb: [1], hm: 'or',
    hc: [
      { k: 'island', mx: 800 },
      { k: 'lagoon', a: 'junk', b: null, mx: 99999 },              // ids scrubbed, mx clamped
      { k: 'enclave', a: [14, 'x'], b: [1], mx: 8 },               // mx clamped up to 16
      { k: 'volcano', mx: 800 },                                   // unknown kind
      { k: 'island', mx: 0 },                                      // no size
      { k: 'island', mx: 'x' },                                    // bad size
      { k: 'enclave', a: [], b: [1], mx: 800 },                    // enclave needs both sets
      { k: 'enclave', a: [14], b: [], mx: 800 },
      'junk',
      null
    ]
  }, 20);
  assert.strictEqual(c.hm, 'or');
  assert.deepStrictEqual(c.hc, [
    { k: 'island', a: [], b: [], mx: 800 },
    { k: 'lagoon', a: [], b: [], mx: 4000 },
    { k: 'enclave', a: [14], b: [1], mx: 16 }
  ]);
});
