import test from 'node:test';
import assert from 'node:assert';
import {
  PATH_MAX, PATH_NAME_MAX, PATH_COORD_LIMIT, PATH_POINT_MAX,
  appendPathPoint, removeLastPathPoint, pathDistance, linkedDistance,
  pointSegmentDist, addPath, removePath, renamePath, pathsFor, parsePaths, mergePaths
} from '../userpaths.js';

const WORLD = { seed: '141', mc: 22, large: false, dim: 0 };
const PTS = [{ x: 0, z: 0 }, { x: 300, z: 0 }, { x: 300, z: 400 }];
const PATH = { ...WORLD, pts: PTS, name: 'mine road' };

test('appendPathPoint appends a rounded point clamped to the world border', () => {
  const pts = appendPathPoint([], 10.6, -1e9);
  assert.deepStrictEqual(pts, [{ x: 11, z: -PATH_COORD_LIMIT }]);
  assert.deepStrictEqual(appendPathPoint(pts, 1e9, 2.2), [pts[0], { x: PATH_COORD_LIMIT, z: 2 }]);
});

test('appendPathPoint skips a repeat of the last waypoint only', () => {
  const pts = appendPathPoint(appendPathPoint([], 5, 5), 9, 9);
  assert.strictEqual(appendPathPoint(pts, 9, 9), pts);
  // revisiting an earlier (non-consecutive) waypoint is a real leg
  assert.strictEqual(appendPathPoint(pts, 5, 5).length, 3);
});

test('appendPathPoint silently drops points beyond the cap', () => {
  let pts = [];
  for (let i = 0; i < PATH_POINT_MAX; i++) pts = appendPathPoint(pts, i, 0);
  assert.strictEqual(pts.length, PATH_POINT_MAX);
  assert.strictEqual(appendPathPoint(pts, 9999, 9999), pts);
});

test('removeLastPathPoint drops the last waypoint and tolerates an empty list', () => {
  assert.deepStrictEqual(removeLastPathPoint(PTS), PTS.slice(0, 2));
  assert.deepStrictEqual(removeLastPathPoint([]), []);
});

test('pathDistance sums the Euclidean segment lengths', () => {
  assert.strictEqual(pathDistance([]), 0);
  assert.strictEqual(pathDistance([{ x: 7, z: 7 }]), 0);
  // 300 + 400 blocks; a 3-4-5 leg rounds the fraction
  assert.strictEqual(pathDistance(PTS), 700);
  assert.strictEqual(pathDistance([{ x: 0, z: 0 }, { x: 1, z: 1 }]), 1);
});

test('linkedDistance converts Overworld->Nether (÷8) and Nether->Overworld (×8)', () => {
  assert.deepStrictEqual(linkedDistance(0, 700), { dim: -1, dist: 88 });
  assert.deepStrictEqual(linkedDistance(-1, 700), { dim: 0, dist: 5600 });
  assert.strictEqual(linkedDistance(1, 700), null);
});

test('pointSegmentDist measures perpendicular, clamped and degenerate cases', () => {
  assert.strictEqual(pointSegmentDist(5, 3, 0, 0, 10, 0), 3);      // above the middle
  assert.strictEqual(pointSegmentDist(-4, 3, 0, 0, 10, 0), 5);     // before the start
  assert.strictEqual(pointSegmentDist(13, 4, 0, 0, 10, 0), 5);     // past the end
  assert.strictEqual(pointSegmentDist(3, 4, 0, 0, 0, 0), 5);       // zero-length segment
});

test('addPath appends a normalized path with a fresh id', () => {
  const list = addPath([], PATH);
  assert.deepStrictEqual(list, [{ id: 1, ...WORLD, pts: PTS, name: 'mine road' }]);
});

test('addPath defaults the name to #id, trims and truncates it', () => {
  const a = addPath([], { ...WORLD, pts: PTS });
  assert.strictEqual(a[0].name, '#1');
  const b = addPath(a, { ...WORLD, pts: PTS.slice(0, 2), name: '   ' });
  assert.strictEqual(b[1].name, '#2');
  const [c] = addPath([], { ...PATH, name: ` ${'x'.repeat(200)} ` });
  assert.strictEqual(c.name.length, PATH_NAME_MAX);
});

test('addPath refuses degenerate paths (fewer than 2 distinct waypoints)', () => {
  assert.deepStrictEqual(addPath([], { ...WORLD, pts: [] }), []);
  assert.deepStrictEqual(addPath([], { ...WORLD, pts: [{ x: 5, z: 5 }] }), []);
  // consecutive duplicates collapse to a single waypoint
  assert.deepStrictEqual(addPath([], { ...WORLD, pts: [{ x: 5, z: 5 }, { x: 5, z: 5 }] }), []);
});

test('addPath refuses malformed waypoints outright', () => {
  assert.deepStrictEqual(addPath([], { ...WORLD, pts: 'nope' }), []);
  assert.deepStrictEqual(addPath([], { ...WORLD, pts: [{ x: 0, z: 0 }, null] }), []);
  assert.deepStrictEqual(addPath([], { ...WORLD, pts: [{ x: 0, z: 0 }, { x: 'a', z: 1 }] }), []);
  assert.deepStrictEqual(addPath([], { ...WORLD, pts: [{ x: 0, z: 0 }, { x: 1, z: Infinity }] }), []);
});

test('addPath skips duplicates (same world + same waypoints) only', () => {
  const one = addPath([], PATH);
  assert.strictEqual(addPath(one, PATH).length, 1);
  // different waypoints in the same world -> appended
  assert.strictEqual(addPath(one, { ...PATH, pts: PTS.slice(0, 2) }).length, 2);
  assert.strictEqual(addPath(one, { ...PATH, pts: [...PTS.slice(0, 2), { x: 9, z: 9 }] }).length, 2);
  // same waypoints in another world -> appended (each world field varied once)
  assert.strictEqual(addPath(one, { ...PATH, seed: '9' }).length, 2);
  assert.strictEqual(addPath(one, { ...PATH, mc: 21 }).length, 2);
  assert.strictEqual(addPath(one, { ...PATH, large: true }).length, 2);
  assert.strictEqual(addPath(one, { ...PATH, dim: -1 }).length, 2);
});

test('addPath silently drops the add beyond the cap', () => {
  let list = [];
  for (let i = 0; i < PATH_MAX; i++) list = addPath(list, { ...PATH, pts: [{ x: i, z: 0 }, { x: i, z: 50 }] });
  assert.strictEqual(list.length, PATH_MAX);
  assert.strictEqual(addPath(list, { ...PATH, pts: [{ x: 0, z: 1 }, { x: 2, z: 3 }] }), list);
});

test('removePath drops the matching id only', () => {
  const list = addPath(addPath([], PATH), { ...PATH, pts: PTS.slice(0, 2) });
  const out = removePath(list, 1);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].id, 2);
});

test('renamePath renames the id, trims and refuses an empty name', () => {
  const list = addPath([], PATH);
  assert.strictEqual(renamePath(list, 1, '  vers la base  ')[0].name, 'vers la base');
  assert.strictEqual(renamePath(list, 1, '   ')[0].name, 'mine road');
  assert.strictEqual(renamePath(list, 1, null)[0].name, 'mine road');
  assert.strictEqual(renamePath(list, 2, 'other')[0].name, 'mine road');
});

test('pathsFor returns the paths of this exact world untouched', () => {
  const list = addPath([], PATH);
  assert.deepStrictEqual(pathsFor(list, WORLD), [{ path: list[0], pts: PTS, converted: false }]);
});

test('pathsFor excludes other seeds, versions and large flags', () => {
  const list = addPath([], PATH);
  assert.deepStrictEqual(pathsFor(list, { ...WORLD, seed: '9' }), []);
  assert.deepStrictEqual(pathsFor(list, { ...WORLD, mc: 21 }), []);
  assert.deepStrictEqual(pathsFor(list, { ...WORLD, large: true }), []);
});

test('pathsFor converts Overworld paths into the Nether at 1:8', () => {
  const list = addPath([], { ...PATH, pts: [{ x: -16, z: 0 }, { x: 801, z: 79 }] });
  const [d] = pathsFor(list, { ...WORLD, dim: -1 });
  assert.strictEqual(d.converted, true);
  assert.deepStrictEqual(d.pts, [{ x: -2, z: 0 }, { x: 100, z: 9 }]);
});

test('pathsFor converts Nether paths into the Overworld at 8:1', () => {
  const list = addPath([], { ...PATH, dim: -1 });
  const [d] = pathsFor(list, WORLD);
  assert.strictEqual(d.converted, true);
  assert.deepStrictEqual(d.pts, [{ x: 0, z: 0 }, { x: 2400, z: 0 }, { x: 2400, z: 3200 }]);
});

test('pathsFor never converts from or into the End', () => {
  const endPath = addPath([], { ...PATH, dim: 1 });
  assert.deepStrictEqual(pathsFor(endPath, WORLD), []);
  assert.strictEqual(pathsFor(endPath, { ...WORLD, dim: 1 }).length, 1);
  const owPath = addPath([], PATH);
  assert.deepStrictEqual(pathsFor(owPath, { ...WORLD, dim: 1 }), []);
  const netherPath = addPath([], { ...PATH, dim: -1 });
  assert.deepStrictEqual(pathsFor(netherPath, { ...WORLD, dim: 1 }), []);
});

test('parsePaths round-trips a serialized list', () => {
  const list = addPath(addPath([], PATH), { ...PATH, dim: -1, name: 'nether hub' });
  assert.deepStrictEqual(parsePaths(JSON.stringify(list)), list);
});

test('parsePaths rejects garbage payloads outright', () => {
  assert.deepStrictEqual(parsePaths(null), []);
  assert.deepStrictEqual(parsePaths('not json'), []);
  assert.deepStrictEqual(parsePaths('{"a":1}'), []);
});

test('parsePaths drops malformed entries and keeps the first id', () => {
  const ok = { id: 1, ...WORLD, pts: PTS, name: 'ok' };
  const bad = [
    null, 42,
    { ...ok, id: 0 }, { ...ok, id: 1.5 },
    { ...ok, mc: 'x' },
    { ...ok, dim: 9 },
    { ...ok, seed: {} },
    { ...ok, name: '   ' },
    { ...ok, name: null },
    { ...ok, pts: 'nope' },
    { ...ok, pts: [{ x: 1, z: 1 }] },
    { ...ok, pts: [{ x: 1, z: 1 }, { x: 'a', z: 2 }] }
  ];
  const out = parsePaths(JSON.stringify([ok, ...bad, { ...ok, name: 'dup id' }]));
  assert.deepStrictEqual(out, [ok]);
});

test('parsePaths normalizes numeric seeds, rounds points and dedupes repeats', () => {
  const raw = [{
    id: 2, seed: 141, mc: 22, large: 1, dim: -1, name: ' hub ',
    pts: [{ x: 10.4, z: -3.6 }, { x: 10, z: -4 }, { x: 50, z: 40 }]
  }];
  const [p] = parsePaths(JSON.stringify(raw));
  assert.deepStrictEqual(p, {
    id: 2, seed: '141', mc: 22, large: true, dim: -1,
    pts: [{ x: 10, z: -4 }, { x: 50, z: 40 }], name: 'hub'
  });
});

test('parsePaths ignores entries and waypoints beyond the caps', () => {
  const many = Array.from({ length: PATH_MAX + 20 }, (_, i) => ({
    id: i + 1, ...WORLD, pts: [{ x: i, z: 0 }, { x: i, z: 50 }], name: 'p' + i
  }));
  assert.strictEqual(parsePaths(JSON.stringify(many)).length, PATH_MAX);
  const long = [{
    id: 1, ...WORLD, name: 'long',
    pts: Array.from({ length: PATH_POINT_MAX + 20 }, (_, i) => ({ x: i, z: 0 }))
  }];
  assert.strictEqual(parsePaths(JSON.stringify(long))[0].pts.length, PATH_POINT_MAX);
});

test('mergePaths appends with fresh ids and skips exact duplicates', () => {
  const mine = addPath([], PATH);
  const theirs = parsePaths(JSON.stringify([
    { id: 7, ...WORLD, pts: PTS, name: 'same route' },
    { id: 8, ...WORLD, pts: [{ x: 1, z: 2 }, { x: 3, z: 4 }], name: 'new' }
  ]));
  const merged = mergePaths(mine, theirs);
  assert.strictEqual(merged.length, 2);
  assert.deepStrictEqual(merged[0], mine[0]);       // input untouched
  assert.strictEqual(merged[1].id, 2);              // fresh id, not 8
  assert.strictEqual(merged[1].name, 'new');
});
