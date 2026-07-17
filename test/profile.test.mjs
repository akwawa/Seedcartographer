import test from 'node:test';
import assert from 'node:assert';
import { PROFILE_KIND, exportProfile, parseProfile, mergeProfile } from '../profile.js';

const FAV = { id: 1, seed: '141', mc: 22, large: false, dim: 0, x: 100, z: -50, note: 'base' };
const PRESET = { id: 1, name: 'cerisiers', dim: 0, c: { m: [5] } };
const HIST = { seed: '141', mc: 22, large: false, dim: 0, cx: 0, cz: 0, crit: { m: [5] }, at: 1000 };
const MARKER = { id: 1, seed: '141', mc: 22, large: false, dim: 0, x: 7, z: 8, name: 'portail' };
const STATE = { favorites: [FAV], userPresets: [PRESET], history: [HIST], markers: [MARKER] };

test('exportProfile -> parseProfile round-trips every store', () => {
  const back = parseProfile(exportProfile(STATE));
  assert.deepStrictEqual(back, STATE);
});

test('parseProfile rejects non-profile payloads', () => {
  assert.strictEqual(parseProfile('not json'), null);
  assert.strictEqual(parseProfile(null), null);
  assert.strictEqual(parseProfile('[1,2]'), null);
  assert.strictEqual(parseProfile('{"kind":"something-else"}'), null);
  // a markers-only export is not a profile
  assert.strictEqual(parseProfile(JSON.stringify([MARKER])), null);
});

test('parseProfile drops malformed entries and tolerates missing lists', () => {
  const p = parseProfile(JSON.stringify({
    kind: PROFILE_KIND, version: 1,
    favorites: [FAV, { bogus: true }, 42],
    userPresets: 'nope',
    markers: [{ ...MARKER, dim: 9 }]
  }));
  assert.deepStrictEqual(p.favorites, [FAV]);
  assert.deepStrictEqual(p.userPresets, []);
  assert.deepStrictEqual(p.history, []);
  assert.deepStrictEqual(p.markers, []);
});

test('mergeProfile skips duplicates and reassigns ids', () => {
  const incoming = parseProfile(exportProfile({
    favorites: [FAV, { ...FAV, id: 9, x: 999 }],
    userPresets: [{ ...PRESET, c: { m: [7] } }, { id: 2, name: 'autre', dim: -1, c: {} }],
    history: [HIST, { ...HIST, cx: 5, at: 2000 }],
    markers: [MARKER, { ...MARKER, id: 4, x: 100 }]
  }));
  const merged = mergeProfile(STATE, incoming);
  // same-spot favorite skipped, new spot appended with a fresh id
  assert.strictEqual(merged.favorites.length, 2);
  assert.strictEqual(merged.favorites[1].x, 999);
  assert.strictEqual(merged.favorites[1].id, 2);
  // same-name preset replaced in place, new name appended
  assert.strictEqual(merged.userPresets.length, 2);
  assert.deepStrictEqual(merged.userPresets[0].c, { m: [7] });
  // identical history entry deduplicated, newest first
  assert.strictEqual(merged.history.length, 2);
  assert.strictEqual(merged.history[0].cx, 5);
  // same-spot marker skipped, new spot appended
  assert.strictEqual(merged.markers.length, 2);
  assert.strictEqual(merged.markers[1].x, 100);
});

test('mergeProfile leaves its inputs untouched', () => {
  const before = JSON.stringify(STATE);
  mergeProfile(STATE, parseProfile(exportProfile(STATE)));
  assert.strictEqual(JSON.stringify(STATE), before);
});
