'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { THEME_COLORS, resolveTheme, otherTheme } = require('../theme.js');

test('a stored choice always wins', () => {
  assert.strictEqual(resolveTheme('light', false), 'light');
  assert.strictEqual(resolveTheme('dark', true), 'dark');
});

test('without a stored choice the system preference decides, defaulting to dark', () => {
  assert.strictEqual(resolveTheme(null, true), 'light');
  assert.strictEqual(resolveTheme(null, false), 'dark');
  assert.strictEqual(resolveTheme('garbage', false), 'dark');
});

test('otherTheme flips between the two themes', () => {
  assert.strictEqual(otherTheme('dark'), 'light');
  assert.strictEqual(otherTheme('light'), 'dark');
});

test('both themes carry a browser-chrome color', () => {
  assert.strictEqual(/^#[0-9a-f]{6}$/.test(THEME_COLORS.dark), true);
  assert.strictEqual(/^#[0-9a-f]{6}$/.test(THEME_COLORS.light), true);
});
