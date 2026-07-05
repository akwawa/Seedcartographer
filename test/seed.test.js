'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { seedToBigInt } = require('../seed.js');

test('numeric seeds pass through as 64-bit integers', () => {
  assert.equal(seedToBigInt('141'), 141n);
  assert.equal(seedToBigInt('0'), 0n);
  assert.equal(seedToBigInt('-1'), -1n);
  assert.equal(seedToBigInt('  42  '), 42n, 'whitespace is trimmed');
});

test('numeric seeds are sign-extended / wrapped to 64 bits like Java long', () => {
  assert.equal(seedToBigInt('9223372036854775807'), 9223372036854775807n);
  // 2^63 overflows a Java long and wraps to its minimum value
  assert.equal(seedToBigInt('9223372036854775808'), -9223372036854775808n);
  // 2^64 wraps to 0
  assert.equal(seedToBigInt('18446744073709551616'), 0n);
});

test('text seeds use Java String.hashCode', () => {
  // Reference values from java.lang.String#hashCode
  assert.equal(seedToBigInt('abc'), 96354n);
  assert.equal(seedToBigInt('a'), 97n);
  assert.equal(seedToBigInt(''), 0n);
  assert.equal(seedToBigInt('Glacier'), BigInt('Glacier'.split('').reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0)));
});

test('text hash wraps to signed 32-bit like Java int overflow', () => {
  // Long strings overflow int in Java; the result must stay in [-2^31, 2^31)
  const h = seedToBigInt('this is a fairly long seed string that overflows an int hash');
  assert.ok(h >= -2147483648n && h <= 2147483647n);
});

test('non-numeric-looking strings are hashed, not parsed', () => {
  // "12e3" is not an integer literal, so it must be hashed as text
  assert.notEqual(seedToBigInt('12e3'), 12000n);
  // "+5" has a plus sign, which Minecraft treats as text
  assert.notEqual(seedToBigInt('+5'), 5n);
});
