// tour.js — first-visit guided tour (#229): pure, testable logic only
// (step sequence, progression, seen-flag semantics, bubble placement math).
// The DOM glue (overlay, bubble, focus trap, localStorage access) lives in
// app.js, exercised by the e2e suite — same split as errorreport.js.

// localStorage key remembering that the tour was already seen (or skipped).
export const TOUR_SEEN_KEY = 'tourSeen';

// The 4 steps, in order: seed → criteria → search → share/export.
// `target` is the CSS selector of the real UI element the bubble anchors to;
// `key` is the i18n key of the bubble text.
export const TOUR_STEPS = [
  { target: '#seed', key: 'tourSeed' },
  { target: '#addMainBiome', key: 'tourCriteria' },
  { target: '#searchBtn', key: 'tourSearch' },
  { target: '#shareBtn', key: 'tourShare' }
];

/**
 * The tour only shows when the seen flag is absent. A read error is passed
 * in as a non-null sentinel by the caller, so a browser with localStorage
 * disabled never gets a tour on every single load — and never blocks the app.
 * @param {string|null} stored raw localStorage value (null = never seen)
 * @returns {boolean} true when the tour should auto-start
 */
export function isFirstVisit(stored) {
  return stored === null;
}

/**
 * @param {number} step current 0-based step index
 * @param {number} total step count
 * @returns {number} next step index, or -1 when the tour is over
 */
export function nextStep(step, total) {
  const n = step + 1;
  return n < total ? n : -1;
}

/**
 * @param {number} step current 0-based step index
 * @param {number} total step count
 * @returns {boolean} true on the final step (the button reads "Done")
 */
export function isLastStep(step, total) {
  return step === total - 1;
}

/**
 * @typedef {{top: number, bottom: number, left: number, width: number}} TargetBox
 * @typedef {{width: number, height: number}} Size
 */

/**
 * Place the bubble next to its target: preferably below, flipped above when
 * there is no room, horizontally centered on the target and clamped so it
 * always stays fully inside the viewport.
 * @param {TargetBox} target bounding box of the highlighted element (viewport coords)
 * @param {Size} bubble measured bubble size
 * @param {Size} viewport viewport size
 * @param {number} [gap] margin between bubble, target and viewport edges
 * @returns {{left: number, top: number}} viewport coordinates for the bubble
 */
export function tourBubblePosition(target, bubble, viewport, gap = 12) {
  let top = target.bottom + gap;
  if (top + bubble.height > viewport.height - gap) top = target.top - bubble.height - gap;
  const maxTop = viewport.height - bubble.height - gap;
  if (top > maxTop) top = maxTop;   // target below the fold: pin to the bottom edge
  if (top < gap) top = gap;
  let left = target.left + target.width / 2 - bubble.width / 2;
  const maxLeft = viewport.width - bubble.width - gap;
  if (left > maxLeft) left = maxLeft;
  if (left < gap) left = gap;
  return { left, top };
}
