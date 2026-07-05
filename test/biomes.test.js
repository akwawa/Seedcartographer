'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { BIOME_NAMES, biomeLabel, prettifyBiome } = require('../biomes.js');

test('all translated languages cover exactly the same biome set', () => {
  const langs = Object.keys(BIOME_NAMES);
  const ref = Object.keys(BIOME_NAMES[langs[0]]).sort();
  assert.ok(ref.length >= 90, 'the engine exposes ~94 biomes');
  for (const lang of langs) {
    assert.deepEqual(Object.keys(BIOME_NAMES[lang]).sort(), ref, `biome key mismatch in ${lang}`);
  }
});

test('no biome translation is empty', () => {
  for (const lang of Object.keys(BIOME_NAMES))
    for (const [key, name] of Object.entries(BIOME_NAMES[lang]))
      assert.ok(name.trim().length > 0, `${lang}.${key} is empty`);
});

test('biomeLabel returns the translation for a known language', () => {
  assert.equal(biomeLabel('cherry_grove', 'fr'), 'Bosquet de cerisiers');
  assert.equal(biomeLabel('warm_ocean', 'de'), 'Warmer Ozean');
  assert.equal(biomeLabel('swamp', 'es'), 'Pantano');
});

test('English and unknown entries fall back to prettified technical names', () => {
  assert.equal(biomeLabel('cherry_grove', 'en'), 'Cherry Grove');
  assert.equal(biomeLabel('made_up_biome', 'fr'), 'Made Up Biome');
  assert.equal(prettifyBiome('the_end'), 'The End');
});
