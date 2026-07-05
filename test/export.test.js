'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resultsToCSV, resultsToJSON, csvField } = require('../export.js');

const HITS = [{ x: 128, z: -256, count: 3 }, { x: -1024, z: 512, count: 0 }];
const META = { seed: '141', mcLabel: '1.21', large: false, criteria: { mainBiomes: [185] } };

test('CSV has a header and one row per hit', () => {
  const lines = resultsToCSV(HITS, META).trim().split('\n');
  assert.equal(lines[0], 'x,z,nearby_structures,seed,mc_version');
  assert.equal(lines.length, 3);
  assert.equal(lines[1], '128,-256,3,141,1.21');
  assert.equal(lines[2], '-1024,512,0,141,1.21');
});

test('CSV escapes text seeds containing separators or quotes', () => {
  const csv = resultsToCSV([HITS[0]], { ...META, seed: 'my, "seed"' });
  assert.ok(csv.includes('"my, ""seed"""'), csv);
});

test('csvField quotes only when needed', () => {
  assert.equal(csvField('plain'), 'plain');
  assert.equal(csvField('a,b'), '"a,b"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField('line\nbreak'), '"line\nbreak"');
});

test('JSON export round-trips with world, criteria and results', () => {
  const parsed = JSON.parse(resultsToJSON(HITS, META));
  assert.equal(parsed.seed, '141');
  assert.equal(parsed.mcVersion, '1.21');
  assert.equal(parsed.largeBiomes, false);
  assert.deepEqual(parsed.criteria, { mainBiomes: [185] });
  assert.deepEqual(parsed.results, [
    { x: 128, z: -256, nearbyStructures: 3 },
    { x: -1024, z: 512, nearbyStructures: 0 }
  ]);
});
