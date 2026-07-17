// Unit tests for tour.js — the pure logic of the first-visit guided tour
// (#229). The DOM glue in app.js is covered by e2e/tour.spec.js.
import test from 'node:test';
import assert from 'node:assert';
import { TOUR_SEEN_KEY, TOUR_STEPS, isFirstVisit, nextStep, isLastStep, tourBubblePosition } from '../tour.js';

test('the tour has at most 4 steps, each anchored to a real element with a text key', () => {
  assert.ok(TOUR_STEPS.length >= 3 && TOUR_STEPS.length <= 4);
  for (const s of TOUR_STEPS) {
    assert.match(s.target, /^#\w+$/);
    assert.match(s.key, /^tour/);
  }
});

test('the seed → criteria → search → share order matches the issue', () => {
  assert.deepStrictEqual(TOUR_STEPS.map((s) => s.target), ['#seed', '#addMainBiome', '#searchBtn', '#shareBtn']);
});

test('the seen flag lives under a stable localStorage key', () => {
  assert.strictEqual(TOUR_SEEN_KEY, 'tourSeen');
});

test('isFirstVisit: only a truly absent flag counts as a first visit', () => {
  assert.strictEqual(isFirstVisit(null), true);          // never seen
  assert.strictEqual(isFirstVisit('1'), false);          // seen or skipped
  assert.strictEqual(isFirstVisit('unavailable'), false); // storage error sentinel
});

test('nextStep walks the sequence and signals the end with -1', () => {
  assert.strictEqual(nextStep(0, 4), 1);
  assert.strictEqual(nextStep(2, 4), 3);
  assert.strictEqual(nextStep(3, 4), -1);
});

test('isLastStep flags only the final step', () => {
  assert.strictEqual(isLastStep(0, 4), false);
  assert.strictEqual(isLastStep(3, 4), true);
});

const vp = { width: 1000, height: 600 };
const bubble = { width: 300, height: 100 };

test('the bubble sits below the target, centered on it', () => {
  const p = tourBubblePosition({ top: 50, bottom: 80, left: 400, width: 200 }, bubble, vp);
  assert.deepStrictEqual(p, { left: 350, top: 92 });
});

test('the bubble flips above the target when there is no room below', () => {
  const p = tourBubblePosition({ top: 480, bottom: 560, left: 400, width: 200 }, bubble, vp);
  assert.deepStrictEqual(p, { left: 350, top: 368 });
});

test('the bubble never leaves the viewport, even for edge targets', () => {
  // target hugging the top-left corner: no room above either → clamped to gap
  const tl = tourBubblePosition({ top: 0, bottom: 550, left: 0, width: 20 }, bubble, vp);
  assert.deepStrictEqual(tl, { left: 12, top: 12 });
  // target hugging the right edge → clamped to the right margin
  const tr = tourBubblePosition({ top: 50, bottom: 80, left: 950, width: 50 }, bubble, vp);
  assert.deepStrictEqual(tr, { left: 688, top: 92 });
  // target entirely below the fold → pinned to the bottom edge, never off-screen
  const below = tourBubblePosition({ top: 900, bottom: 930, left: 400, width: 200 }, bubble, vp);
  assert.deepStrictEqual(below, { left: 350, top: 488 });
});

test('a custom gap replaces the default margin', () => {
  const p = tourBubblePosition({ top: 50, bottom: 80, left: 400, width: 200 }, bubble, vp, 20);
  assert.deepStrictEqual(p, { left: 350, top: 100 });
});
