import test from 'node:test';
import assert from 'node:assert';
import { parseLocationsCSV, splitCSVLine, resultsToCSV } from '../export.js';

test('round-trip: the CSV export parses back into the same pins', () => {
  const hits = [{ x: 128, z: -256, count: 3 }, { x: -1024, z: 512, count: 0 }];
  const csv = resultsToCSV(hits, { seed: 'a,b "quoted"', mcLabel: '1.21' });
  assert.deepStrictEqual(parseLocationsCSV(csv), { hits, skipped: 0 });
});

test('header is ignored and malformed rows are counted', () => {
  const { hits, skipped } = parseLocationsCSV('x,z\n1,2\noops,3\n4,\n5,6,9\n');
  assert.deepStrictEqual(hits, [{ x: 1, z: 2, count: 0 }, { x: 5, z: 6, count: 9 }]);
  assert.strictEqual(skipped, 2);
});

test('a headerless file works and non-integer counts fall back to 0', () => {
  const { hits, skipped } = parseLocationsCSV('7,8,not-a-number\r\n-9,10\r\n');
  assert.deepStrictEqual(hits, [{ x: 7, z: 8, count: 0 }, { x: -9, z: 10, count: 0 }]);
  assert.strictEqual(skipped, 0);
});

test('output is capped', () => {
  const big = Array.from({ length: 20 }, (_, i) => `${i},${i}`).join('\n');
  assert.strictEqual(parseLocationsCSV(big, 5).hits.length, 5);
});

test('splitCSVLine honours quotes and escaped quotes', () => {
  assert.deepStrictEqual(splitCSVLine('1,"a,b","he said ""hi""",2'), ['1', 'a,b', 'he said "hi"', '2']);
  assert.deepStrictEqual(splitCSVLine(''), ['']);
});
