// searchqueue.js — pure state logic for the multi-seed search queue (#324):
// queue entries (criteria snapshots) with statuses, sequential-run
// transitions and the aggregation/sorting of the cumulative comparative
// table. ES module shared between app.js and the Node test suite.

/**
 * @typedef {{seed: string, hit: {x: number, z: number}, count: number,
 *            dist: number}} QueueCandidate
 * @typedef {{label: string, crit: object, mode: string, count: number,
 *            radius: number, status: string, results: QueueCandidate[]}} QueueEntry
 * @typedef {{entries: QueueEntry[], current: number}} SearchQueue
 * @typedef {{entry: number, label: string, seed: string, count: number,
 *            dist: number, hit: {x: number, z: number}}} QueueRow
 */

/** @returns {SearchQueue} an empty queue with no running entry */
export function createQueue() {
  return { entries: [], current: -1 };
}

// Append a captured criteria set to the queue; it starts pending with no
// results. Returns a new queue (input untouched).
/**
 * @param {SearchQueue} queue
 * @param {{label: string, crit: object, mode: string, count: number, radius: number}} entry
 * @returns {SearchQueue}
 */
export function addEntry(queue, entry) {
  return {
    ...queue,
    entries: [...queue.entries, { ...entry, status: 'pending', results: [] }]
  };
}

// Remove a pending entry (only pending entries can be withdrawn); the
// running-entry index shifts when an earlier entry disappears.
/**
 * @param {SearchQueue} queue
 * @param {number} index
 * @returns {SearchQueue}
 */
export function removeEntry(queue, index) {
  const e = queue.entries[index];
  if (!e || e.status !== 'pending') return queue;
  return {
    entries: queue.entries.filter((_, i) => i !== index),
    current: queue.current > index ? queue.current - 1 : queue.current
  };
}

/** @param {SearchQueue} queue @returns {number} index of the next pending entry, or -1 */
export function nextPending(queue) {
  return queue.entries.findIndex((e) => e.status === 'pending');
}

/** @param {SearchQueue} queue @returns {boolean} true while an entry is running */
export function isRunning(queue) {
  return queue.current >= 0;
}

// Promote the next pending entry to running; null when nothing is left.
/**
 * @param {SearchQueue} queue
 * @returns {SearchQueue|null}
 */
export function startNext(queue) {
  const i = nextPending(queue);
  if (i < 0) return null;
  return {
    entries: queue.entries.map((e, j) => (j === i ? { ...e, status: 'running' } : e)),
    current: i
  };
}

// The running entry finished: store its findings and clear the run marker.
/**
 * @param {SearchQueue} queue
 * @param {QueueCandidate[]} results
 * @returns {SearchQueue}
 */
export function completeCurrent(queue, results) {
  if (!isRunning(queue)) return queue;
  return {
    entries: queue.entries.map((e, j) =>
      (j === queue.current ? { ...e, status: 'done', results } : e)),
    current: -1
  };
}

// Stop the whole queue: the running entry and every pending one are marked
// cancelled; completed entries keep their results.
/**
 * @param {SearchQueue} queue
 * @returns {SearchQueue}
 */
export function cancelQueue(queue) {
  return {
    entries: queue.entries.map((e) =>
      (e.status === 'pending' || e.status === 'running' ? { ...e, status: 'cancelled' } : e)),
    current: -1
  };
}

// Flatten every entry's findings into the rows of the comparative table.
/**
 * @param {QueueEntry[]} entries
 * @returns {QueueRow[]}
 */
export function aggregateResults(entries) {
  /** @type {QueueRow[]} */
  const rows = [];
  entries.forEach((e, i) => {
    for (const c of e.results || []) {
      rows.push({ entry: i, label: e.label, seed: c.seed, count: c.count, dist: c.dist, hit: c.hit });
    }
  });
  return rows;
}

// Score ordering shared by the sort keys: more places first, then closest,
// then the seed string as a deterministic tie-break (#113 semantics).
/**
 * @param {QueueRow} a
 * @param {QueueRow} b
 * @returns {number}
 */
function byScore(a, b) {
  return (b.count - a.count) || (a.dist - b.dist) || a.seed.localeCompare(b.seed);
}

/** @type {Record<string, (a: QueueRow, b: QueueRow) => number>} */
const ROW_COMPARATORS = {
  entry: (a, b) => (a.entry - b.entry) || byScore(a, b),
  seed: (a, b) => a.seed.localeCompare(b.seed),
  score: byScore,
  dist: (a, b) => (a.dist - b.dist) || byScore(a, b)
};

// Table sorting by column key ('entry' | 'seed' | 'score' | 'dist');
// unknown keys fall back to the score order. Returns a new array.
/**
 * @param {QueueRow[]} rows
 * @param {string} key
 * @returns {QueueRow[]}
 */
export function sortRows(rows, key) {
  return [...rows].sort(ROW_COMPARATORS[key] || byScore);
}

// Short human summary of a captured criteria set (readCriteria() shape):
// the main-biome names plus the number of extra clauses, e.g. "Plains +2".
// Empty string when nothing can be summarized (caller picks a fallback).
/**
 * @param {object} crit criteria snapshot (readCriteria() shape)
 * @param {(id: number) => string} biomeName biome id -> localized label ('' if unknown)
 * @returns {string}
 */
export function summarizeCriteria(crit, biomeName) {
  const anyCrit = /** @type {Record<string, unknown>} */ (crit);
  const ids = Array.isArray(anyCrit.mb) ? /** @type {number[]} */ (anyCrit.mb) : [];
  const names = ids.map((b) => biomeName(b)).filter((n) => n);
  let clauses = 0;
  for (const k of ['ac', 'qc', 'hc', 'sc', 'pc']) {
    const list = anyCrit[k];
    if (Array.isArray(list)) clauses += list.length;
  }
  const head = names.join(' | ');
  if (head && clauses) return `${head} +${clauses}`;
  if (head) return head;
  if (clauses) return `+${clauses}`;
  return '';
}
