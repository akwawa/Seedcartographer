import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { test } from 'node:test';
import assert from 'node:assert';
const { HISTORY_MAX, addHistoryEntry, parseHistory } = require('../searchhistory.js');

const entry = (seed, cx = 0, extra = {}) => ({
  seed, mc: 30, large: false, dim: 0, cx, cz: 0, crit: { mb: [185] }, at: 1, ...extra
});

test('addHistoryEntry prepends and caps the list', () => {
  let list = [];
  for (let i = 0; i < HISTORY_MAX + 3; i++) list = addHistoryEntry(list, entry(String(i)));
  assert.strictEqual(list.length, HISTORY_MAX);
  assert.strictEqual(list[0].seed, String(HISTORY_MAX + 2));
});

test('re-running an identical search moves it to the top without duplicating', () => {
  let list = addHistoryEntry([], entry('a'));
  list = addHistoryEntry(list, entry('b'));
  list = addHistoryEntry(list, entry('a', 0, { at: 99 }));   // same identity, newer timestamp
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].seed, 'a');
  assert.strictEqual(list[0].at, 99);
});

test('a different zone or world is a distinct entry', () => {
  let list = addHistoryEntry([], entry('a'));
  list = addHistoryEntry(list, entry('a', 500));
  list = addHistoryEntry(list, entry('a', 0, { dim: -1 }));
  assert.strictEqual(list.length, 3);
});

test('parseHistory keeps only well-formed entries', () => {
  const good = entry('141');
  const raw = JSON.stringify([good, { seed: 'x' }, null, 42, { ...good, mc: 'nope' }]);
  const list = parseHistory(raw);
  assert.strictEqual(list.length, 1);
  assert.deepStrictEqual(list[0], good);
});

test('parseHistory survives garbage payloads', () => {
  assert.deepStrictEqual(parseHistory(null), []);
  assert.deepStrictEqual(parseHistory('not json'), []);
  assert.deepStrictEqual(parseHistory('{"a":1}'), []);
});

test('normalization defaults the seed and the timestamp', () => {
  const raw = JSON.stringify([{ mc: 30, dim: 0, cx: 0, cz: 0, crit: {} }]);
  const [e] = parseHistory(raw);
  assert.strictEqual(e.seed, '0');
  assert.strictEqual(e.at, 0);
});
