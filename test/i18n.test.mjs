import test from 'node:test';
import assert from 'node:assert';
import { I18N, I18N_LANGS, resolveNavLang } from '../i18n.js';

test('every locale in the language picker has a translation table', () => {
  for (const [code] of I18N_LANGS) assert.ok(I18N[code], `missing table for ${code}`);
});

test('all locales expose exactly the same keys as English', () => {
  const ref = Object.keys(I18N.en).sort();
  for (const lang of Object.keys(I18N)) {
    assert.deepStrictEqual(Object.keys(I18N[lang]).sort(), ref, `key mismatch in ${lang}`);
  }
});

test('placeholders match the English ones in every locale', () => {
  const holes = (s) => (s.match(/\{\w+\}/g) || []).sort();
  for (const key of Object.keys(I18N.en)) {
    const ref = holes(I18N.en[key]);
    for (const lang of Object.keys(I18N)) {
      assert.deepStrictEqual(holes(I18N[lang][key]), ref, `placeholder mismatch for ${lang}.${key}`);
    }
  }
});

test('no translation is empty', () => {
  for (const lang of Object.keys(I18N))
    for (const key of Object.keys(I18N[lang]))
      assert.ok(I18N[lang][key].trim().length > 0, `${lang}.${key} is empty`);
});

test('resolveNavLang maps navigator.language values to supported codes', () => {
  assert.strictEqual(resolveNavLang('fr-FR'), 'fr');
  assert.strictEqual(resolveNavLang('ja'), 'ja');
  assert.strictEqual(resolveNavLang('ru-RU'), 'ru');
  assert.strictEqual(resolveNavLang('pl-PL'), 'pl');
  assert.strictEqual(resolveNavLang('PT-br'), 'pt');
});

test('resolveNavLang handles the Chinese region variants', () => {
  assert.strictEqual(resolveNavLang('zh-CN'), 'zh-CN');
  assert.strictEqual(resolveNavLang('zh'), 'zh-CN');
  assert.strictEqual(resolveNavLang('zh-Hans-CN'), 'zh-CN');
  // no dedicated traditional-Chinese table yet: zh-TW/zh-HK fall back to zh-CN
  assert.strictEqual(resolveNavLang('zh-TW'), 'zh-CN');
  assert.strictEqual(resolveNavLang('zh-HK'), 'zh-CN');
});

test('resolveNavLang falls back to English for unknown or missing values', () => {
  assert.strictEqual(resolveNavLang('ko-KR'), 'en');
  assert.strictEqual(resolveNavLang(''), 'en');
  assert.strictEqual(resolveNavLang(undefined), 'en');
});
