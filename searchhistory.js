// searchhistory.js — recent searches, replayable in one click. Pure list
// operations, shared between app.js (script tag, backed by localStorage) and
// the Node test suite (require). No data ever leaves the browser.
'use strict';

const HISTORY_MAX = 10;   // recent searches kept, newest first

// an entry captures everything a replay needs: the world, the criteria (in
// the share-hash shape produced by readCriteria) and the searched zone
/**
 * @typedef {{seed: string, mc: number, large: boolean, dim: number,
 *            cx: number, cz: number, crit: object, at: number}} HistoryEntry
 */

// identity of an entry — same world, same criteria, same zone
/** @param {HistoryEntry} e @returns {string} */
function historyKey(e) {
  return JSON.stringify([String(e.seed), e.mc, !!e.large, e.dim, e.cx, e.cz, e.crit]);
}

// newest first; re-running an identical search moves it to the top instead
// of piling up duplicates
/**
 * @param {HistoryEntry[]} list current history
 * @param {HistoryEntry} entry search to record
 * @param {number} [max] size cap
 * @returns {HistoryEntry[]} new list (input untouched)
 */
function addHistoryEntry(list, entry, max = HISTORY_MAX) {
  const k = historyKey(entry);
  return [entry, ...list.filter((e) => historyKey(e) !== k)].slice(0, max);
}

// localStorage contents are outside the app's control: only well-formed
// entries survive (the criteria object itself is re-sanitized on replay)
/**
 * @param {any} e candidate entry
 * @returns {HistoryEntry|null}
 */
function normalizeHistoryEntry(e) {
  if (!e || typeof e !== 'object' || typeof e.crit !== 'object' || e.crit === null) return null;
  const mc = Number(e.mc), dim = Number(e.dim), cx = Number(e.cx), cz = Number(e.cz), at = Number(e.at);
  if (![mc, dim, cx, cz].every(Number.isFinite)) return null;
  return {
    seed: String(e.seed ?? '0'), mc, large: !!e.large, dim,
    cx, cz, crit: e.crit, at: Number.isFinite(at) ? at : 0
  };
}

/**
 * @param {string|null} json raw localStorage payload
 * @returns {HistoryEntry[]} well-formed entries only
 */
function parseHistory(json) {
  let raw;
  try { raw = JSON.parse(String(json)); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, HISTORY_MAX).map(normalizeHistoryEntry).filter((e) => e !== null);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HISTORY_MAX, addHistoryEntry, parseHistory };
}
