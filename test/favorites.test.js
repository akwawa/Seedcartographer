'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  FAV_MAX, favWorld, addFavorite, findFavorite, removeFavorite,
  updateFavoriteNote, favoritesFor, parseFavorites
} = require('../favorites.js');

const spot = { seed: '141', mc: 28, large: false, dim: 0, x: -384, z: 0 };

test('favWorld extracts the world a favorite is bound to', () => {
  const fav = addFavorite([], spot)[0];
  assert.deepStrictEqual(favWorld(fav), { seed: '141', mc: 28, large: false, dim: 0 });
});

test('addFavorite assigns unique ids and keeps the list immutable', () => {
  const l1 = addFavorite([], spot);
  const l2 = addFavorite(l1, { ...spot, x: 100 });
  assert.strictEqual(l1.length, 1);
  assert.strictEqual(l2.length, 2);
  assert.strictEqual(l2[0].id !== l2[1].id, true);
  assert.strictEqual(l1.length, 1); // l1 untouched
});

test('the same spot in the same world is not added twice', () => {
  const l = addFavorite(addFavorite([], spot), { ...spot });
  assert.strictEqual(l.length, 1);
  // same coordinates in another dimension are a different favorite
  assert.strictEqual(addFavorite(l, { ...spot, dim: -1 }).length, 2);
});

test('remove and note update target by id', () => {
  let l = addFavorite(addFavorite([], spot), { ...spot, x: 7 });
  l = updateFavoriteNote(l, l[0].id, 'base spot');
  assert.strictEqual(l[0].note, 'base spot');
  assert.strictEqual(l[1].note, '');
  l = removeFavorite(l, l[0].id);
  assert.strictEqual(l.length, 1);
  assert.strictEqual(l[0].x, 7);
});

test('favoritesFor filters by seed, version, large and dimension', () => {
  let l = addFavorite([], spot);
  l = addFavorite(l, { ...spot, seed: 'other' });
  l = addFavorite(l, { ...spot, mc: 25, x: 1 });
  l = addFavorite(l, { ...spot, large: true, x: 2 });
  assert.strictEqual(favoritesFor(l, spot).length, 1);
  assert.strictEqual(findFavorite(l, spot, spot).x, -384);
});

test('parseFavorites keeps only well-formed entries', () => {
  const good = { id: 1, seed: '141', mc: 28, large: false, dim: 0, x: 1, z: 2, note: 'ok' };
  const json = JSON.stringify([
    good,
    { ...good, id: 1 },              // duplicate id
    { ...good, id: 2, dim: 9 },      // invalid dimension
    { ...good, id: 3, x: 'oops' },   // non-integer coordinate
    'garbage', null,
    { ...good, id: 4, seed: 141, note: 42 }  // numeric seed ok, bad note reset
  ]);
  const l = parseFavorites(json);
  assert.deepStrictEqual(l.map((f) => f.id), [1, 4]);
  assert.strictEqual(l[1].seed, '141');
  assert.strictEqual(l[1].note, '');
  assert.deepStrictEqual(parseFavorites('not json'), []);
  assert.deepStrictEqual(parseFavorites('{"a":1}'), []);
});

test('the list is capped', () => {
  let l = [];
  for (let i = 0; i < FAV_MAX + 5; i++) l = addFavorite(l, { ...spot, x: i });
  assert.strictEqual(l.length, FAV_MAX);
});

test('favorites with a non-string, non-number seed are dropped', () => {
  const good = { id: 1, seed: 141, mc: 30, large: false, dim: 0, x: 1, z: 2, note: 'n' };
  const bad = { ...good, id: 2, seed: { nope: true } };
  const list = parseFavorites(JSON.stringify([good, bad]));
  assert.deepStrictEqual(list.map((f) => f.id), [1]);
  assert.strictEqual(list[0].seed, '141');   // numeric seeds are stringified
});
