import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { test } from 'node:test';
import assert from 'node:assert';
const {
  MARKER_MAX, addMarker, removeMarker, renameMarker, markersFor, parseMarkers, mergeMarkers
} = require('../usermarkers.js');

const W = { seed: '141', mc: 30, large: false, dim: 0 };
const at = (x, z, name) => ({ ...W, x, z, name });

test('addMarker appends with fresh ids and a default name', () => {
  let list = addMarker([], at(10, 20));
  assert.deepStrictEqual(list[0], { id: 1, ...W, x: 10, z: 20, name: '#1' });
  list = addMarker(list, at(30, 40, '  Base principale  '));
  assert.strictEqual(list[1].name, 'Base principale');
  assert.strictEqual(list[1].id, 2);
});

test('duplicates (same world and spot) and overflow are refused', () => {
  let list = addMarker([], at(10, 20));
  assert.strictEqual(addMarker(list, at(10, 20, 'again')), list);
  // a different world at the same spot is fine
  assert.strictEqual(addMarker(list, { ...at(10, 20), dim: -1 }).length, 2);
  let full = [];
  for (let i = 0; i < MARKER_MAX; i++) full = addMarker(full, at(i, 0));
  assert.strictEqual(addMarker(full, at(9999, 9999)), full);
});

test('rename trims and refuses empty names; remove drops by id', () => {
  let list = addMarker([], at(1, 2, 'A'));
  list = renameMarker(list, 1, '  B  ');
  assert.strictEqual(list[0].name, 'B');
  assert.strictEqual(renameMarker(list, 1, '   ')[0].name, 'B');
  assert.deepStrictEqual(removeMarker(list, 1), []);
});

test('markersFor filters on the exact world', () => {
  let list = addMarker([], at(1, 2));
  list = addMarker(list, { ...at(3, 4), mc: 29 });
  assert.strictEqual(markersFor(list, W).length, 1);
  assert.strictEqual(markersFor(list, { ...W, mc: 29 }).length, 1);
});

test('parseMarkers keeps only well-formed entries', () => {
  const good = { id: 3, ...W, x: 5, z: 6, name: 'ok' };
  const raw = JSON.stringify([good, { id: 3, ...W, x: 9, z: 9, name: 'dup id' },
    { id: 4, ...W, x: 1, z: 1, name: '' }, { id: 5, ...W, x: 'NaN', z: 0, name: 'bad x' },
    { id: 6, ...W, dim: 7, x: 0, z: 0, name: 'bad dim' }, null, 'junk']);
  assert.deepStrictEqual(parseMarkers(raw), [good]);
  assert.deepStrictEqual(parseMarkers('not json'), []);
});

test('mergeMarkers imports with fresh ids and skips exact duplicates', () => {
  const mine = addMarker([], at(1, 2, 'mine'));
  const theirs = [{ id: 1, ...W, x: 1, z: 2, name: 'dup spot' }, { id: 9, ...W, x: 7, z: 8, name: 'new' }];
  const merged = mergeMarkers(mine, theirs);
  assert.deepStrictEqual(merged.map((m) => [m.id, m.name]), [[1, 'mine'], [2, 'new']]);
});

test('renameMarker tolerates a null name and unknown ids', () => {
  const list = addMarker([], at(1, 2, 'A'));
  assert.strictEqual(renameMarker(list, 1, null)[0].name, 'A');
  assert.strictEqual(renameMarker(list, 99, 'B')[0].name, 'A');
});

test('normalization rejects bad ids, versions and seed types, accepts numeric seeds', () => {
  const good = { id: 3, ...W, x: 5, z: 6, name: 'ok' };
  const bad = [
    { ...good, id: 0 },                    // id must be a positive integer
    { ...good, id: 'x' },
    { ...good, mc: 1.5 },                  // mc must be an integer
    { ...good, name: undefined },          // missing name
    { ...good, seed: { nope: true } }      // seed must be string or number
  ];
  assert.deepStrictEqual(parseMarkers(JSON.stringify(bad)), []);
  const numSeed = parseMarkers(JSON.stringify([{ ...good, seed: 141 }]));
  assert.strictEqual(numSeed[0].seed, '141');
  // valid JSON that is not an array yields an empty list
  assert.deepStrictEqual(parseMarkers('{"a":1}'), []);
});
