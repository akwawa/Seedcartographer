'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { I18N, I18N_LANGS } = require('../i18n.js');

test('every locale in the language picker has a translation table', () => {
  for (const [code] of I18N_LANGS) assert.ok(I18N[code], `missing table for ${code}`);
});

test('all locales expose exactly the same keys as English', () => {
  const ref = Object.keys(I18N.en).sort();
  for (const lang of Object.keys(I18N)) {
    assert.deepEqual(Object.keys(I18N[lang]).sort(), ref, `key mismatch in ${lang}`);
  }
});

test('placeholders match the English ones in every locale', () => {
  const holes = (s) => (s.match(/\{\w+\}/g) || []).sort();
  for (const key of Object.keys(I18N.en)) {
    const ref = holes(I18N.en[key]);
    for (const lang of Object.keys(I18N)) {
      assert.deepEqual(holes(I18N[lang][key]), ref, `placeholder mismatch for ${lang}.${key}`);
    }
  }
});

test('no translation is empty', () => {
  for (const lang of Object.keys(I18N))
    for (const key of Object.keys(I18N[lang]))
      assert.ok(I18N[lang][key].trim().length > 0, `${lang}.${key} is empty`);
});
