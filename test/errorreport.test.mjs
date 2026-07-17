import test from 'node:test';
import assert from 'node:assert';
import { sanitizeErrorMessage, sourceBasename, formatErrorEvent } from '../errorreport.js';

test('sanitizeErrorMessage collapses whitespace and truncates', () => {
  assert.strictEqual(sanitizeErrorMessage('  hello\n\tworld  '), 'hello world');
  assert.strictEqual(sanitizeErrorMessage(null), '');
  assert.strictEqual(sanitizeErrorMessage(undefined), '');
  const long = 'x'.repeat(250);
  const out = sanitizeErrorMessage(long);
  assert.strictEqual(out.length, 201);
  assert.ok(out.endsWith('…'));
});

test('sourceBasename strips path, query and hash', () => {
  assert.strictEqual(sourceBasename('https://seedcarto.com/app.js?v=3#x'), 'app.js');
  assert.strictEqual(sourceBasename('./worker.js'), 'worker.js');
  assert.strictEqual(sourceBasename(null), '');
  assert.strictEqual(sourceBasename(''), '');
});

test('formatErrorEvent builds a bounded, PII-free payload', () => {
  assert.deepStrictEqual(
    formatErrorEvent('error', 'Boom', 'https://x/app.js?y=1', 42),
    { kind: 'error', message: 'Boom', source: 'app.js', line: 42 }
  );
  assert.deepStrictEqual(
    formatErrorEvent('promise', 'oops', undefined, 'not-a-number'),
    { kind: 'promise', message: 'oops', source: '', line: 0 }
  );
});
