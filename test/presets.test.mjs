import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import test from 'node:test';
import assert from 'node:assert';
const { PRESETS, presetCriteria } = require('../presets.js');
const { I18N, I18N_LANGS } = require('../i18n.js');

test('presets are well-formed', () => {
  const ids = new Set();
  for (const p of PRESETS) {
    assert.strictEqual(typeof p.id, 'string');
    assert.strictEqual(ids.has(p.id), false, `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.strictEqual(p.c.mb.length > 0, true, `${p.id}: a main biome is required`);
    for (const b of p.c.mb) assert.strictEqual(Number.isInteger(b), true);
    assert.strictEqual(['and', 'or'].includes(p.c.am), true);
    assert.strictEqual(['and', 'or'].includes(p.c.sm), true);
    for (const a of p.c.ac) {
      assert.strictEqual(Number.isInteger(a.b) && Number.isInteger(a.d) && a.d > 0, true);
    }
    for (const s of p.c.sc) {
      assert.strictEqual(Number.isInteger(s.si) && s.si >= 0, true);
      assert.strictEqual(s.mn > 0 && s.r > 0, true);
    }
    assert.strictEqual(p.c.rg > 0 && p.c.sp > 0, true);
  }
});

test('preset labels exist in every language', () => {
  for (const p of PRESETS) {
    for (const [lang] of I18N_LANGS) {
      assert.strictEqual(typeof I18N[lang][p.labelKey], 'string', `${p.labelKey} missing in ${lang}`);
    }
  }
});

test('presetCriteria resolves stable structure indices to engine values', () => {
  const preset = PRESETS.find((p) => p.id === 'cherry-ocean');
  const types = Array.from({ length: 20 }, (_, i) => 100 + i); // fake engine map
  const c = presetCriteria(preset, types);
  assert.deepStrictEqual(c.mb, [185]);
  assert.deepStrictEqual(c.sc, [{ t: 100, mn: 2, r: 800 }]); // si 0 -> types[0]
  assert.deepStrictEqual(c.ac, [{ b: 44, d: 400, n: 0 }]);
});

test('presetCriteria drops clauses whose structure index is unknown', () => {
  const preset = PRESETS.find((p) => p.id === 'slime-farm'); // uses si 19
  const c = presetCriteria(preset, [7]); // engine map too short
  assert.deepStrictEqual(c.sc, []);
  assert.deepStrictEqual(c.mb, [1]);
});

test('presetCriteria returns copies, not references into the preset', () => {
  const preset = PRESETS.find((p) => p.id === 'cherry-ocean');
  const c = presetCriteria(preset, Array.from({ length: 20 }, (_, i) => i));
  c.mb.push(999); c.ac[0].d = 1;
  assert.deepStrictEqual(preset.c.mb, [185]);
  assert.strictEqual(preset.c.ac[0].d, 400);
});
