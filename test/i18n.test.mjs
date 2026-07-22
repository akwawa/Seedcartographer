import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
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

// #270: the version selector and dimension names must be translatable
test('the dimension and version-selector labels have i18n keys', () => {
  for (const key of ['dimOverworld', 'dimNether', 'dimEnd', 'mcverTitle', 'verJavaLbl'])
    for (const lang of Object.keys(I18N))
      assert.ok(I18N[lang][key], `missing ${lang}.${key}`);
});

// #270 guard: a hardcoded title attribute in index.html stays English in every
// other language — each one must carry a data-i18n-title so applyI18n covers it.
test('every title attribute in index.html carries data-i18n-title', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const tags = html.match(/<[a-z][^>]*\stitle="[^"]*"[^>]*>/g) || [];
  assert.ok(tags.length > 0, 'expected title attributes in index.html');
  for (const tag of tags) assert.match(tag, /data-i18n-title="/, `untranslated title: ${tag}`);
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

// #271: tooltips advertise their keyboard shortcut in every locale
test('shortcut-bearing tooltips mention their key in every locale', () => {
  const hints = { rulerTitle: 'R', cmpSwapTitle: 'V', gotoAria: 'G', helpBtnTitle: '\\?' };
  for (const [key, letter] of Object.entries(hints))
    for (const lang of Object.keys(I18N))
      assert.match(I18N[lang][key], new RegExp(`[(（]${letter}[)）]`), `${lang}.${key} misses (${letter})`);
  for (const lang of Object.keys(I18N))
    assert.match(I18N[lang].searchBtnTitle, /[(（](Enter|Entrée|Invio)[)）]/, `${lang}.searchBtnTitle misses (Enter)`);
});

// #271: the help dialog documents the four map tools
test('index.html help dialog lists the map tools with i18n keys', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const tools = html.match(/<ul class="help-keys help-tools">[\s\S]*?<\/ul>/);
  assert.ok(tools, 'missing .help-tools list in the help dialog');
  for (const key of ['helpToolRuler', 'helpToolMarker', 'helpToolSel', 'helpToolZone'])
    assert.match(tools[0], new RegExp(`data-i18n="${key}"`), `missing ${key} entry`);
});
