// Global keyboard shortcuts (#230): the pure key+context → action mapping.
import test from 'node:test';
import assert from 'node:assert';
import { keyAction } from '../keys.js';

// baseline context: map has focus, nothing open, no modifier
const base = { key: '', mod: false, inInput: false, inSearchField: false, tourOpen: false, dialogOpen: false };
const ctx = (over) => ({ ...base, ...over });

test('bare keys map to their actions', () => {
  assert.strictEqual(keyAction(ctx({ key: '+' })), 'zoom-in');
  assert.strictEqual(keyAction(ctx({ key: '=' })), 'zoom-in');
  assert.strictEqual(keyAction(ctx({ key: '-' })), 'zoom-out');
  assert.strictEqual(keyAction(ctx({ key: '_' })), 'zoom-out');
  assert.strictEqual(keyAction(ctx({ key: 'g' })), 'goto');
  assert.strictEqual(keyAction(ctx({ key: 'G' })), 'goto');
  assert.strictEqual(keyAction(ctx({ key: 'r' })), 'ruler');
  assert.strictEqual(keyAction(ctx({ key: 'R' })), 'ruler');
  assert.strictEqual(keyAction(ctx({ key: '?' })), 'help');
  assert.strictEqual(keyAction(ctx({ key: 'Escape' })), 'close');
});

test('unmapped keys do nothing', () => {
  assert.strictEqual(keyAction(ctx({ key: 'x' })), null);
  assert.strictEqual(keyAction(ctx({ key: 'ArrowLeft' })), null);
});

test('a held Ctrl/Meta/Alt modifier disables every shortcut', () => {
  assert.strictEqual(keyAction(ctx({ key: 'r', mod: true })), null);
  assert.strictEqual(keyAction(ctx({ key: 'Escape', mod: true })), null);
  assert.strictEqual(keyAction(ctx({ key: 'Enter', mod: true, inSearchField: true, inInput: true })), null);
});

test('typing in a field disables letter/zoom shortcuts but not Escape', () => {
  for (const key of ['g', 'r', '?', '+', '-']) {
    assert.strictEqual(keyAction(ctx({ key, inInput: true })), null, key);
  }
  assert.strictEqual(keyAction(ctx({ key: 'Escape', inInput: true })), 'close');
});

test('Enter runs the search only from a criteria-panel field', () => {
  assert.strictEqual(keyAction(ctx({ key: 'Enter', inInput: true, inSearchField: true })), 'search');
  // any other field (goto box, sync-code textarea…) keeps its own Enter
  assert.strictEqual(keyAction(ctx({ key: 'Enter', inInput: true })), null);
  assert.strictEqual(keyAction(ctx({ key: 'Enter' })), null);
  // not while a modal dialog covers the panel
  assert.strictEqual(keyAction(ctx({ key: 'Enter', inInput: true, inSearchField: true, dialogOpen: true })), null);
});

test('while the tour runs, Escape skips it and everything else is off', () => {
  assert.strictEqual(keyAction(ctx({ key: 'Escape', tourOpen: true })), 'skip-tour');
  for (const key of ['Enter', 'g', 'r', '?', '+', '-']) {
    assert.strictEqual(keyAction(ctx({ key, tourOpen: true })), null, key);
  }
});

test('while a modal dialog is open, only Escape acts', () => {
  assert.strictEqual(keyAction(ctx({ key: 'Escape', dialogOpen: true })), 'close');
  for (const key of ['g', 'r', '?', '+', '-']) {
    assert.strictEqual(keyAction(ctx({ key, dialogOpen: true })), null, key);
  }
});
