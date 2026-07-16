import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { validateGalleryEntry, validateGallery, galleryEntryHash, galleryText, galleryThumbRender, galleryStructRender, galleryThumbPoint } from '../gallery.js';
import { decodeShareState, sanitizeWorldView, sanitizeCriteria } from '../sharestate.js';

const ENTRY = {
  id: 'spot-1', seed: '141', mc: 28, large: false, dim: 0,
  x: -384, z: 0, b: 2, y: 60,
  title: { en: 'A spot', fr: 'Un lieu' }, desc: { en: 'Something', fr: 'Quelque chose' }
};

test('the committed gallery.json is fully valid', () => {
  const raw = JSON.parse(fs.readFileSync(`${import.meta.dirname}/../gallery.json`, 'utf8'));
  const valid = validateGallery(raw);
  assert.ok(raw.length > 0, 'the gallery has entries');
  assert.strictEqual(valid.length, raw.length, 'every committed entry must validate');
  // every entry produces a hash the app can decode and sanitize
  for (const e of valid) {
    const state = decodeShareState(galleryEntryHash(e));
    const wv = sanitizeWorldView(state);
    assert.ok(wv, `${e.id}: world/view decodes`);
    assert.strictEqual(wv.seed, e.seed);
    assert.strictEqual(wv.cx, e.x);
    if (e.c) assert.ok(sanitizeCriteria(state.c, 8), `${e.id}: criteria sanitize`);
  }
});

test('validateGalleryEntry rejects malformed entries', () => {
  assert.ok(validateGalleryEntry(ENTRY));
  assert.strictEqual(validateGalleryEntry(null), null);
  assert.strictEqual(validateGalleryEntry('x'), null);
  assert.strictEqual(validateGalleryEntry({ ...ENTRY, id: 'Bad Id!' }), null);
  assert.strictEqual(validateGalleryEntry({ ...ENTRY, id: 42 }), null);
  assert.strictEqual(validateGalleryEntry({ ...ENTRY, seed: {} }), null);
  assert.strictEqual(validateGalleryEntry({ ...ENTRY, mc: 'x' }), null);
  assert.strictEqual(validateGalleryEntry({ ...ENTRY, dim: 5 }), null);
  assert.strictEqual(validateGalleryEntry({ ...ENTRY, b: 0 }), null);
  assert.strictEqual(validateGalleryEntry({ ...ENTRY, title: { fr: 'sans anglais' } }), null);
  assert.strictEqual(validateGalleryEntry({ ...ENTRY, title: 'plain' }), null);
  assert.strictEqual(validateGalleryEntry({ ...ENTRY, desc: { en: '  ' } }), null);
  assert.strictEqual(validateGalleryEntry({ ...ENTRY, c: 'nope' }), null);
  assert.strictEqual(validateGalleryEntry({ ...ENTRY, c: null }), null);
  // numeric seed and criteria object are accepted
  const ok = validateGalleryEntry({ ...ENTRY, seed: 141, c: { mb: [5] } });
  assert.strictEqual(ok.seed, '141');
  assert.deepStrictEqual(ok.c, { mb: [5] });
});

test('validateGallery drops junk and duplicate ids', () => {
  const list = validateGallery([ENTRY, { ...ENTRY }, { ...ENTRY, id: 'spot-2' }, 'junk']);
  assert.deepStrictEqual(list.map((e) => e.id), ['spot-1', 'spot-2']);
  assert.deepStrictEqual(validateGallery('not-a-list'), []);
});

test('galleryEntryHash carries the criteria only when present', () => {
  const bare = decodeShareState(galleryEntryHash(validateGalleryEntry(ENTRY)));
  assert.strictEqual(bare.c, undefined);
  const withC = decodeShareState(galleryEntryHash(validateGalleryEntry({ ...ENTRY, c: { mb: [5] } })));
  assert.deepStrictEqual(withC.c, { mb: [5] });
  const large = decodeShareState(galleryEntryHash(validateGalleryEntry({ ...ENTRY, large: true })));
  assert.strictEqual(large.l, 1);
});

test('galleryText falls back to English', () => {
  assert.strictEqual(galleryText({ en: 'hello', fr: 'bonjour' }, 'fr'), 'bonjour');
  assert.strictEqual(galleryText({ en: 'hello', fr: 'bonjour' }, 'de'), 'hello');
  assert.strictEqual(galleryText({ en: 'hello', de: ' ' }, 'de'), 'hello');
});

test('galleryThumbRender builds a full worker render message', () => {
  const e = validateGalleryEntry({ ...ENTRY, large: true, c: { mb: [5] } });
  assert.deepStrictEqual(galleryThumbRender(e, 7, 260, 140), {
    type: 'render', reqId: 7, seed: '141', mc: 28, large: true,
    dim: 0, y: 60, highlight: null, cx: e.x, cz: e.z, bpp: e.b, w: 260, h: 140
  });
});

test('galleryStructRender covers the thumbnail world box', () => {
  const e = validateGalleryEntry(ENTRY);
  assert.deepStrictEqual(galleryStructRender(e, 9, 260, 140, [3, 4]), {
    type: 'structures', reqId: 9, seed: '141', mc: 28, large: false, dim: 0,
    types: [3, 4], x0: -384 - 260, z0: -140, x1: -384 + 260, z1: 140
  });
});

test('galleryThumbPoint projects world coordinates onto the thumbnail', () => {
  const e = validateGalleryEntry(ENTRY);
  assert.deepStrictEqual(galleryThumbPoint(e, 260, 140, e.x, e.z), { px: 130, py: 70 });
  assert.deepStrictEqual(galleryThumbPoint(e, 260, 140, e.x + 2 * e.b, e.z - 4 * e.b), { px: 132, py: 66 });
});
