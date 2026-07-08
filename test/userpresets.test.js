'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
  USER_PRESET_MAX, USER_PRESET_NAME_MAX, addUserPreset, removeUserPreset, parseUserPresets
} = require('../userpresets.js');

const crit = { mb: [185], am: 'and' };

test('addUserPreset appends with fresh ids and trims/caps the name', () => {
  let list = addUserPreset([], '  Cerisiers  ', 0, crit);
  assert.strictEqual(list.length, 1);
  assert.deepStrictEqual(list[0], { id: 1, name: 'Cerisiers', dim: 0, c: crit });
  list = addUserPreset(list, 'x'.repeat(80), -1, crit);
  assert.strictEqual(list[1].name.length, USER_PRESET_NAME_MAX);
  assert.strictEqual(list[1].id, 2);
});

test('saving under an existing name replaces that preset in place', () => {
  let list = addUserPreset([], 'A', 0, crit);
  const c2 = { mb: [14] };
  list = addUserPreset(list, 'A', 1, c2);
  assert.strictEqual(list.length, 1);
  assert.deepStrictEqual(list[0], { id: 1, name: 'A', dim: 1, c: c2 });
});

test('empty names and full lists are refused', () => {
  assert.strictEqual(addUserPreset([], '   ', 0, crit).length, 0);
  let list = [];
  for (let i = 0; i < USER_PRESET_MAX; i++) list = addUserPreset(list, `p${i}`, 0, crit);
  assert.strictEqual(addUserPreset(list, 'one too many', 0, crit), list);
});

test('removeUserPreset drops by id and leaves the input untouched', () => {
  const list = addUserPreset(addUserPreset([], 'A', 0, crit), 'B', 0, crit);
  const out = removeUserPreset(list, 1);
  assert.deepStrictEqual(out.map((p) => p.name), ['B']);
  assert.strictEqual(list.length, 2);
});

test('parseUserPresets keeps only well-formed entries, first id wins', () => {
  const good = { id: 3, name: 'ok', dim: 0, c: crit };
  const raw = JSON.stringify([good, { id: 3, name: 'dup', dim: 0, c: crit },
    { id: -1, name: 'bad id', dim: 0, c: crit }, { id: 4, name: '', dim: 0, c: crit },
    { id: 5, name: 'no crit', dim: 0 }, null, 'junk']);
  assert.deepStrictEqual(parseUserPresets(raw), [good]);
});

test('parseUserPresets survives garbage payloads', () => {
  assert.deepStrictEqual(parseUserPresets(null), []);
  assert.deepStrictEqual(parseUserPresets('not json'), []);
  assert.deepStrictEqual(parseUserPresets('{"a":1}'), []);
});
