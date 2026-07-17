import test from 'node:test';
import assert from 'node:assert';
import { BIOME_NAMES, biomeLabel, prettifyBiome } from '../biomes.js';
import { currentLang } from '../i18n.js';
import { readFileSync } from 'node:fs';

test('all translated languages cover exactly the same biome set', () => {
  const langs = Object.keys(BIOME_NAMES);
  const ref = Object.keys(BIOME_NAMES[langs[0]]).sort();
  assert.ok(ref.length >= 90, 'the engine exposes ~94 biomes');
  for (const lang of langs) {
    assert.deepStrictEqual(Object.keys(BIOME_NAMES[lang]).sort(), ref, `biome key mismatch in ${lang}`);
  }
});

test('no biome translation is empty', () => {
  for (const lang of Object.keys(BIOME_NAMES))
    for (const [key, name] of Object.entries(BIOME_NAMES[lang]))
      assert.ok(name.trim().length > 0, `${lang}.${key} is empty`);
});

test('biomeLabel returns the translation for a known language', () => {
  assert.strictEqual(biomeLabel('cherry_grove', 'fr'), 'Bosquet de cerisiers');
  assert.strictEqual(biomeLabel('warm_ocean', 'de'), 'Warmer Ozean');
  assert.strictEqual(biomeLabel('swamp', 'es'), 'Pantano');
});

test('English and unknown entries fall back to prettified technical names', () => {
  assert.strictEqual(biomeLabel('cherry_grove', 'en'), 'Cherry Grove');
  assert.strictEqual(biomeLabel('made_up_biome', 'fr'), 'Made Up Biome');
  assert.strictEqual(prettifyBiome('the_end'), 'The End');
});

test('biomeLabel defaults to English outside the browser and prettify keeps empty segments', () => {
  // no lang argument and no currentLang global: the 'en' fallback branch
  assert.strictEqual(biomeLabel('cherry_grove'), 'Cherry Grove');
  // unknown language code falls back to prettified English too
  assert.strictEqual(biomeLabel('cherry_grove', 'xx'), 'Cherry Grove');
  // double underscore produces an empty segment (kept as-is)
  assert.strictEqual(prettifyBiome('a__b'), 'A  B');
});

test('biomeLabel defaults to the UI language exported by i18n.js', () => {
  // biomes.js imports the live `currentLang` binding from i18n.js; outside a
  // browser (no document) i18n.js initializes it to 'en'
  assert.strictEqual(currentLang(), 'en');
  assert.strictEqual(biomeLabel('cherry_grove'), 'Cherry Grove');
  assert.strictEqual(biomeLabel('cherry_grove', 'fr'), BIOME_NAMES.fr.cherry_grove);
});

test('every language translates the full cubiomes biome list', () => {
  // canonical name list straight from the pinned cubiomes submodule
  const src = readFileSync('cubiomes/util.c', 'utf8');
  const body = src.match(/biome2str[^{]*\{([^]*?)\n\}/)[1];
  const names = [...new Set([...body.matchAll(/return "(\w+)"/g)].map((m) => m[1]))];
  assert.ok(names.length >= 100);
  for (const lang of Object.keys(BIOME_NAMES)) {
    const missing = names.filter((n) => !BIOME_NAMES[lang][n]);
    assert.deepStrictEqual(missing, [], `${lang} is missing ${missing.length} biome name(s)`);
  }
});
