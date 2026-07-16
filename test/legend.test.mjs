import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import test from 'node:test';
import assert from 'node:assert';
const { legendEntries } = require('../legend.js');

const biomes = [
  { id: 1, name: 'plains', rgb: [140, 180, 90] },
  { id: 44, name: 'warm_ocean', rgb: [60, 90, 200] },
  { id: 185, name: 'cherry_grove', rgb: [230, 170, 200] }
];
const upper = (n) => n.toUpperCase();

test('entries are deduplicated and sorted by localized label', () => {
  const e = legendEntries([185, 44, 185, 1, 44], biomes, upper);
  assert.deepStrictEqual(e.map((x) => x.name), ['cherry_grove', 'plains', 'warm_ocean']);
  assert.deepStrictEqual(e[0], { id: 185, name: 'cherry_grove', rgb: [230, 170, 200], label: 'CHERRY_GROVE' });
});

test('unknown biome ids are dropped', () => {
  assert.deepStrictEqual(legendEntries([1, 999], biomes, upper).map((x) => x.id), [1]);
});

test('the label function drives the ordering', () => {
  const rev = (n) => (n === 'plains' ? 'zzz' : n);
  assert.deepStrictEqual(legendEntries([1, 44], biomes, rev).map((x) => x.id), [44, 1]);
});

test('empty input yields an empty legend', () => {
  assert.deepStrictEqual(legendEntries([], biomes, upper), []);
});
