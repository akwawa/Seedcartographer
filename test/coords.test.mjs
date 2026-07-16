import test from 'node:test';
import assert from 'node:assert';
import { convertCoords } from '../coords.js';

test('Overworld coordinates divide by 8 towards the Nether (floored)', () => {
  assert.deepStrictEqual(convertCoords(0, -384, 0), { label: 'Nether', x: -48, z: 0 });
  assert.deepStrictEqual(convertCoords(0, 15, -15), { label: 'Nether', x: 1, z: -2 });
});

test('Nether coordinates multiply by 8 towards the Overworld', () => {
  assert.deepStrictEqual(convertCoords(-1, -1968, -2000), { label: 'Overworld', x: -15744, z: -16000 });
});

test('the End has no linked dimension', () => {
  assert.strictEqual(convertCoords(1, 100, 100), null);
});
