// vitals.js — pure bucketing logic for real-user Core Web Vitals (#322).
// Raw values are never sent to analytics: each metric is reduced to its
// official rating (good / needs-improvement / poor) plus a coarse range
// label, so the Umami event carries no fine-grained fingerprintable data.
// The PerformanceObserver wiring and the umami.track() call live in app.js
// (DOM glue, exercised by e2e); this module only holds the testable logic.
//
// Official thresholds (https://web.dev/articles/vitals):
//   LCP: good ≤ 2500 ms, poor > 4000 ms
//   INP: good ≤ 200 ms,  poor > 500 ms
//   CLS: good ≤ 0.1,     poor > 0.25
// INP is approximated as the maximum `event` entry duration (no per-
// interaction grouping); CLS is the simple sum of all layout-shift scores
// without user input (no 5-second session windowing) — both intentionally
// simple, documented approximations that only need to be bucket-accurate.

export const LCP_THRESHOLDS = { good: 2500, poor: 4000 };
export const INP_THRESHOLDS = { good: 200, poor: 500 };
export const CLS_THRESHOLDS = { good: 0.1, poor: 0.25 };

/**
 * @param {number} value measured value
 * @param {{good: number, poor: number}} thresholds metric thresholds
 * @returns {'good'|'needs-improvement'|'poor'} official rating
 */
export function rateVital(value, thresholds) {
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * @param {number} value measured value
 * @param {{good: number, poor: number}} thresholds metric thresholds
 * @param {[string, string, string]} labels range labels (good, mid, poor)
 * @returns {string} coarse human-readable range label
 */
function rangeLabel(value, thresholds, labels) {
  if (value <= thresholds.good) return labels[0];
  if (value <= thresholds.poor) return labels[1];
  return labels[2];
}

/**
 * Builds the anonymous Umami event payload for one metric. The raw value is
 * bucketed and never included.
 * @param {'LCP'|'INP'|'CLS'} metric
 * @param {number} value LCP/INP in milliseconds, CLS unitless
 * @returns {{metric: string, rating: string, bucket: string}|null} payload,
 * or null when the value is not a finite non-negative number (nothing to send)
 */
export function formatVitalsEvent(metric, value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  if (metric === 'LCP') {
    return { metric, rating: rateVital(value, LCP_THRESHOLDS), bucket: rangeLabel(value, LCP_THRESHOLDS, ['≤2.5s', '2.5–4s', '>4s']) };
  }
  if (metric === 'INP') {
    return { metric, rating: rateVital(value, INP_THRESHOLDS), bucket: rangeLabel(value, INP_THRESHOLDS, ['≤200ms', '200–500ms', '>500ms']) };
  }
  if (metric === 'CLS') {
    return { metric, rating: rateVital(value, CLS_THRESHOLDS), bucket: rangeLabel(value, CLS_THRESHOLDS, ['≤0.1', '0.1–0.25', '>0.25']) };
  }
  return null;
}

/**
 * INP approximation: the worst (longest) event duration observed. The spec
 * uses the p98 interaction; for an anonymous bucket the maximum is a simple,
 * slightly pessimistic stand-in.
 * @param {number[]} durations `event` entry durations in milliseconds
 * @returns {number|null} estimate, or null when nothing was observed
 */
export function inpEstimate(durations) {
  let max = null;
  for (const d of durations) {
    if (max === null || d > max) max = d;
  }
  return max;
}

/**
 * CLS approximation: plain sum of layout-shift scores that had no recent
 * user input (documented simplification — no 5 s session windows).
 * @param {Array<{value: number, hadRecentInput?: boolean}>} entries
 * @returns {number} cumulative score
 */
export function clsTotal(entries) {
  let sum = 0;
  for (const e of entries) {
    if (!e.hadRecentInput) sum += e.value;
  }
  return sum;
}
