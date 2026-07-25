// Unit tests for searchqueue.js (#324): queue transitions, comparative-table
// aggregation/sorting and the criteria summary label.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createQueue, addEntry, removeEntry, nextPending, isRunning,
  startNext, completeCurrent, cancelQueue,
  aggregateResults, sortRows, summarizeCriteria
} from '../searchqueue.js';

const entry = (label = 'a') => ({ label, crit: { mb: [1] }, mode: 'seq', count: 5, radius: 1500 });
const cand = (seed, count, dist) => ({ seed, hit: { x: 10, z: -20 }, count, dist });

test('createQueue starts empty and idle', () => {
  const q = createQueue();
  assert.deepEqual(q, { entries: [], current: -1 });
  assert.equal(isRunning(q), false);
  assert.equal(nextPending(q), -1);
});

test('addEntry appends a pending entry without mutating the input', () => {
  const q0 = createQueue();
  const q1 = addEntry(q0, entry('plains'));
  assert.equal(q0.entries.length, 0);
  assert.equal(q1.entries.length, 1);
  assert.equal(q1.entries[0].status, 'pending');
  assert.deepEqual(q1.entries[0].results, []);
  assert.equal(q1.entries[0].label, 'plains');
  assert.equal(nextPending(q1), 0);
});

test('removeEntry withdraws a pending entry only', () => {
  let q = addEntry(addEntry(createQueue(), entry('a')), entry('b'));
  const q2 = removeEntry(q, 0);
  assert.equal(q2.entries.length, 1);
  assert.equal(q2.entries[0].label, 'b');
  // out-of-range index: unchanged
  assert.equal(removeEntry(q, 5), q);
  // a running entry cannot be withdrawn
  const running = startNext(q);
  assert.equal(removeEntry(running, 0), running);
});

test('removeEntry shifts the running index when an earlier entry goes away', () => {
  let q = addEntry(addEntry(createQueue(), entry('a')), entry('b'));
  q = startNext(q);                       // 'a' running, current = 0
  q = completeCurrent(q, []);             // 'a' done
  q = startNext(q);                       // 'b' running, current = 1
  // 'a' is done, not removable: current untouched
  assert.equal(removeEntry(q, 0).current, 1);
  // removing a pending entry after the running one keeps current
  let q3 = addEntry(q, entry('c'));
  assert.equal(removeEntry(q3, 2).current, 1);
  // removing a pending entry before the running one shifts current
  let q4 = addEntry(createQueue(), entry('a'));
  q4 = addEntry(q4, entry('b'));
  q4 = { ...q4, entries: q4.entries.map((e, i) => (i === 1 ? { ...e, status: 'running' } : e)), current: 1 };
  const q5 = removeEntry(q4, 0);
  assert.equal(q5.current, 0);
  assert.equal(q5.entries[0].status, 'running');
});

test('startNext promotes the first pending entry, null when none is left', () => {
  const q0 = createQueue();
  assert.equal(startNext(q0), null);
  let q = addEntry(addEntry(q0, entry('a')), entry('b'));
  q = startNext(q);
  assert.equal(q.current, 0);
  assert.equal(q.entries[0].status, 'running');
  assert.equal(q.entries[1].status, 'pending');
  assert.equal(isRunning(q), true);
});

test('completeCurrent stores the findings and clears the run marker', () => {
  let q = startNext(addEntry(createQueue(), entry('a')));
  const res = [cand('1', 2, 100)];
  q = completeCurrent(q, res);
  assert.equal(q.current, -1);
  assert.equal(q.entries[0].status, 'done');
  assert.deepEqual(q.entries[0].results, res);
  // no running entry: no-op
  assert.equal(completeCurrent(q, []), q);
});

test('cancelQueue marks running and pending entries cancelled, keeps done ones', () => {
  let q = addEntry(addEntry(addEntry(createQueue(), entry('a')), entry('b')), entry('c'));
  q = completeCurrent(startNext(q), [cand('7', 1, 50)]);   // 'a' done
  q = startNext(q);                                        // 'b' running
  q = cancelQueue(q);
  assert.equal(q.current, -1);
  assert.deepEqual(q.entries.map((e) => e.status), ['done', 'cancelled', 'cancelled']);
  assert.equal(q.entries[0].results.length, 1);            // kept
});

test('aggregateResults flattens every entry findings into table rows', () => {
  let q = addEntry(addEntry(createQueue(), entry('plains')), entry('forest'));
  q = completeCurrent(startNext(q), [cand('11', 3, 200), cand('12', 1, 40)]);
  q = completeCurrent(startNext(q), [cand('21', 2, 90)]);
  const rows = aggregateResults(q.entries);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { entry: 0, label: 'plains', seed: '11', count: 3, dist: 200, hit: { x: 10, z: -20 } });
  assert.equal(rows[2].entry, 1);
  assert.equal(rows[2].label, 'forest');
  // defensive: an entry without a results array contributes nothing
  assert.deepEqual(aggregateResults([{ label: 'x' }]), []);
});

const ROWS = [
  { entry: 1, label: 'b', seed: '5', count: 1, dist: 300, hit: { x: 0, z: 0 } },
  { entry: 0, label: 'a', seed: '3', count: 2, dist: 100, hit: { x: 0, z: 0 } },
  { entry: 0, label: 'a', seed: '1', count: 2, dist: 100, hit: { x: 0, z: 0 } },
  { entry: 1, label: 'b', seed: '4', count: 2, dist: 50, hit: { x: 0, z: 0 } }
];

test('sortRows by score: more places first, then closest, then seed', () => {
  const sorted = sortRows(ROWS, 'score');
  assert.deepEqual(sorted.map((r) => r.seed), ['4', '1', '3', '5']);
  assert.notEqual(sorted, ROWS);                    // new array
  assert.equal(ROWS[0].seed, '5');                  // input untouched
});

test('sortRows by entry keeps queue order, score inside an entry', () => {
  assert.deepEqual(sortRows(ROWS, 'entry').map((r) => r.seed), ['1', '3', '4', '5']);
});

test('sortRows by seed and by distance', () => {
  assert.deepEqual(sortRows(ROWS, 'seed').map((r) => r.seed), ['1', '3', '4', '5']);
  assert.deepEqual(sortRows(ROWS, 'dist').map((r) => r.seed), ['4', '1', '3', '5']);
});

test('sortRows falls back to the score order on an unknown key', () => {
  assert.deepEqual(sortRows(ROWS, 'nope').map((r) => r.seed), ['4', '1', '3', '5']);
});

test('summarizeCriteria joins main-biome names and counts extra clauses', () => {
  const name = (id) => ({ 1: 'Plains', 2: 'Forest' })[id] || '';
  assert.equal(summarizeCriteria({ mb: [1, 2], ac: [{}], sc: [{}, {}] }, name), 'Plains | Forest +3');
  assert.equal(summarizeCriteria({ mb: [1] }, name), 'Plains');
  assert.equal(summarizeCriteria({ mb: [-1], qc: [{}] }, name), '+1');   // unknown biome filtered
  assert.equal(summarizeCriteria({ mb: [], hc: [{}], pc: [{}] }, name), '+2');
  assert.equal(summarizeCriteria({}, name), '');                          // nothing to say
  assert.equal(summarizeCriteria({ mb: 'bad', ac: 'bad' }, name), '');    // malformed snapshot
});
