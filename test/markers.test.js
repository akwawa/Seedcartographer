'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { SPAWN_STRUCT_TYPE, STRONGHOLD_STRUCT_TYPE } = require('../markers.js');
const { SLIME_STRUCT_TYPE } = require('../slime.js');

test('synthetic marker types are negative and mutually distinct', () => {
  const types = [SLIME_STRUCT_TYPE, SPAWN_STRUCT_TYPE, STRONGHOLD_STRUCT_TYPE];
  for (const t of types) assert.strictEqual(t < 0, true, 'must not collide with engine enums');
  assert.strictEqual(new Set(types).size, types.length);
});
