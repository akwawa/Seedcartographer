'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { mapCartoucheLines, exportFileName } = require('../export.js');

test('cartouche lines describe seed, version, dimension and center', () => {
  const lines = mapCartoucheLines({
    seed: 'my seed', mcLabel: '1.21', large: false, dimension: 'Nether', cx: -48, cz: 12
  });
  assert.deepStrictEqual(lines, [
    'Seed: my seed',
    'Java 1.21 — Nether',
    'Center: -48, 12'
  ]);
});

test('Large Biomes worlds are flagged in the cartouche', () => {
  const lines = mapCartoucheLines({
    seed: '141', mcLabel: '1.18', large: true, dimension: 'Overworld', cx: 0, cz: 0
  });
  assert.strictEqual(lines[1], 'Java 1.18 (Large Biomes) — Overworld');
});

test('export file names sanitize the seed', () => {
  assert.strictEqual(exportFileName('141', 'map', 'png'), 'seedcartographer-141-map.png');
  assert.strictEqual(exportFileName('mon île !', 'map', 'png'), 'seedcartographer-mon_le_-map.png');
  assert.strictEqual(exportFileName(-7799461267186613798n, 'map', 'png'),
    'seedcartographer--7799461267186613798-map.png');
});
