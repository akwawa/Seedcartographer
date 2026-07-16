import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import test from 'node:test';
import assert from 'node:assert';
const { SPAWN_STRUCT_TYPE, STRONGHOLD_STRUCT_TYPE } = require('../markers.js');
const { SLIME_STRUCT_TYPE } = require('../slime.js');

test('synthetic marker types are negative and mutually distinct', () => {
  const types = [SLIME_STRUCT_TYPE, SPAWN_STRUCT_TYPE, STRONGHOLD_STRUCT_TYPE];
  for (const t of types) assert.strictEqual(t < 0, true, 'must not collide with engine enums');
  assert.strictEqual(new Set(types).size, types.length);
});
