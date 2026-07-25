import test from 'node:test';
import assert from 'node:assert';
import {
  LCP_THRESHOLDS, INP_THRESHOLDS, CLS_THRESHOLDS,
  rateVital, formatVitalsEvent, inpEstimate, clsTotal
} from '../vitals.js';

test('thresholds match the official Core Web Vitals values', () => {
  assert.deepStrictEqual(LCP_THRESHOLDS, { good: 2500, poor: 4000 });
  assert.deepStrictEqual(INP_THRESHOLDS, { good: 200, poor: 500 });
  assert.deepStrictEqual(CLS_THRESHOLDS, { good: 0.1, poor: 0.25 });
});

test('rateVital classifies against inclusive thresholds', () => {
  assert.strictEqual(rateVital(0, LCP_THRESHOLDS), 'good');
  assert.strictEqual(rateVital(2500, LCP_THRESHOLDS), 'good');
  assert.strictEqual(rateVital(2500.01, LCP_THRESHOLDS), 'needs-improvement');
  assert.strictEqual(rateVital(4000, LCP_THRESHOLDS), 'needs-improvement');
  assert.strictEqual(rateVital(4000.01, LCP_THRESHOLDS), 'poor');
});

test('formatVitalsEvent buckets LCP milliseconds', () => {
  assert.deepStrictEqual(formatVitalsEvent('LCP', 1200),
    { metric: 'LCP', rating: 'good', bucket: '≤2.5s' });
  assert.deepStrictEqual(formatVitalsEvent('LCP', 3000),
    { metric: 'LCP', rating: 'needs-improvement', bucket: '2.5–4s' });
  assert.deepStrictEqual(formatVitalsEvent('LCP', 4001),
    { metric: 'LCP', rating: 'poor', bucket: '>4s' });
});

test('formatVitalsEvent buckets INP milliseconds', () => {
  assert.deepStrictEqual(formatVitalsEvent('INP', 80),
    { metric: 'INP', rating: 'good', bucket: '≤200ms' });
  assert.deepStrictEqual(formatVitalsEvent('INP', 200),
    { metric: 'INP', rating: 'good', bucket: '≤200ms' });
  assert.deepStrictEqual(formatVitalsEvent('INP', 350),
    { metric: 'INP', rating: 'needs-improvement', bucket: '200–500ms' });
  assert.deepStrictEqual(formatVitalsEvent('INP', 501),
    { metric: 'INP', rating: 'poor', bucket: '>500ms' });
});

test('formatVitalsEvent buckets unitless CLS', () => {
  assert.deepStrictEqual(formatVitalsEvent('CLS', 0.05),
    { metric: 'CLS', rating: 'good', bucket: '≤0.1' });
  assert.deepStrictEqual(formatVitalsEvent('CLS', 0.2),
    { metric: 'CLS', rating: 'needs-improvement', bucket: '0.1–0.25' });
  assert.deepStrictEqual(formatVitalsEvent('CLS', 0.3),
    { metric: 'CLS', rating: 'poor', bucket: '>0.25' });
});

test('formatVitalsEvent rejects invalid values and unknown metrics', () => {
  assert.strictEqual(formatVitalsEvent('LCP', NaN), null);
  assert.strictEqual(formatVitalsEvent('LCP', Infinity), null);
  assert.strictEqual(formatVitalsEvent('INP', -1), null);
  // @ts-expect-error deliberately wrong type
  assert.strictEqual(formatVitalsEvent('CLS', '0.1'), null);
  // @ts-expect-error deliberately wrong metric
  assert.strictEqual(formatVitalsEvent('FCP', 100), null);
  // @ts-expect-error deliberately missing value
  assert.strictEqual(formatVitalsEvent('LCP', undefined), null);
});

test('inpEstimate returns the worst duration or null when empty', () => {
  assert.strictEqual(inpEstimate([]), null);
  assert.strictEqual(inpEstimate([48]), 48);
  assert.strictEqual(inpEstimate([120, 48, 350, 200]), 350);
  assert.strictEqual(inpEstimate([50, 50]), 50);
});

test('clsTotal sums shifts and skips those with recent input', () => {
  assert.strictEqual(clsTotal([]), 0);
  assert.strictEqual(clsTotal([{ value: 0.05 }, { value: 0.07 }]), 0.05 + 0.07);
  assert.strictEqual(clsTotal([
    { value: 0.05, hadRecentInput: false },
    { value: 0.4, hadRecentInput: true },
    { value: 0.02 }
  ]), 0.05 + 0.02);
});
