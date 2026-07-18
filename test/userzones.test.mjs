import test from 'node:test';
import assert from 'node:assert';
import {
  ZONE_MAX, ZONE_NAME_MAX, ZONE_COORD_LIMIT, ZONE_COLORS,
  addZone, removeZone, renameZone, recolorZone, zonesFor, parseZones, mergeZones
} from '../userzones.js';

const WORLD = { seed: '141', mc: 22, large: false, dim: 0 };
const RECT = { x0: 0, z0: 0, x1: 100, z1: 80 };
const ZONE = { ...WORLD, ...RECT, name: 'base', color: ZONE_COLORS[1] };

test('addZone appends a normalized zone with a fresh id', () => {
  const list = addZone([], ZONE);
  assert.strictEqual(list.length, 1);
  assert.deepStrictEqual(list[0], { id: 1, ...WORLD, ...RECT, name: 'base', color: ZONE_COLORS[1] });
});

test('addZone orders dragged corners and clamps to the world border', () => {
  const [z] = addZone([], {
    ...WORLD, x0: 120, z0: 90, x1: -1e9, z1: -30, name: 'big', color: ZONE_COLORS[0]
  });
  assert.deepStrictEqual([z.x0, z.z0, z.x1, z.z1], [-ZONE_COORD_LIMIT, -30, 120, 90]);
});

test('addZone defaults the name to #id and the color to the first palette entry', () => {
  const a = addZone([], { ...WORLD, ...RECT });
  assert.strictEqual(a[0].name, '#1');
  assert.strictEqual(a[0].color, ZONE_COLORS[0]);
  // a blank name falls back too, an off-palette color is coerced
  const b = addZone(a, { ...WORLD, ...RECT, x1: 500, name: '   ', color: '#123456' });
  assert.strictEqual(b[1].name, '#2');
  assert.strictEqual(b[1].color, ZONE_COLORS[0]);
});

test('addZone truncates over-long names', () => {
  const [z] = addZone([], { ...WORLD, ...RECT, name: 'x'.repeat(200) });
  assert.strictEqual(z.name.length, ZONE_NAME_MAX);
});

test('addZone refuses degenerate rectangles (a line or a point)', () => {
  assert.deepStrictEqual(addZone([], { ...WORLD, x0: 5, z0: 0, x1: 5, z1: 80 }), []);
  assert.deepStrictEqual(addZone([], { ...WORLD, x0: 0, z0: 7, x1: 80, z1: 7 }), []);
  assert.deepStrictEqual(addZone([], { ...WORLD, x0: 3, z0: 3, x1: 3, z1: 3 }), []);
});

test('addZone skips duplicates (same world + same rectangle) only', () => {
  const one = addZone([], ZONE);
  assert.strictEqual(addZone(one, ZONE).length, 1);
  // same world, different rectangle -> appended (each corner varied once)
  assert.strictEqual(addZone(one, { ...ZONE, x0: -5 }).length, 2);
  assert.strictEqual(addZone(one, { ...ZONE, z0: -5 }).length, 2);
  assert.strictEqual(addZone(one, { ...ZONE, x1: 105 }).length, 2);
  assert.strictEqual(addZone(one, { ...ZONE, z1: 85 }).length, 2);
  // same rectangle in another world -> appended (each world field varied once)
  assert.strictEqual(addZone(one, { ...ZONE, seed: '9' }).length, 2);
  assert.strictEqual(addZone(one, { ...ZONE, mc: 21 }).length, 2);
  assert.strictEqual(addZone(one, { ...ZONE, large: true }).length, 2);
  assert.strictEqual(addZone(one, { ...ZONE, dim: -1 }).length, 2);
});

test('addZone silently drops the add beyond the cap', () => {
  let list = [];
  for (let i = 0; i < ZONE_MAX; i++) list = addZone(list, { ...ZONE, x1: 200 + i });
  assert.strictEqual(list.length, ZONE_MAX);
  assert.strictEqual(addZone(list, { ...ZONE, x1: 9999 }), list);
});

test('removeZone drops the matching id only', () => {
  const list = addZone(addZone([], ZONE), { ...ZONE, x1: 500 });
  const out = removeZone(list, 1);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].id, 2);
});

test('renameZone renames the id, trims and refuses an empty name', () => {
  const list = addZone([], ZONE);
  assert.strictEqual(renameZone(list, 1, '  spawn farm  ')[0].name, 'spawn farm');
  assert.strictEqual(renameZone(list, 1, '   ')[0].name, 'base');
  assert.strictEqual(renameZone(list, 1, null)[0].name, 'base');
  assert.strictEqual(renameZone(list, 2, 'other')[0].name, 'base');
});

test('recolorZone accepts palette colors only and targets the id', () => {
  const list = addZone(addZone([], ZONE), { ...ZONE, x1: 500 });
  const out = recolorZone(list, 1, ZONE_COLORS[3]);
  assert.strictEqual(out[0].color, ZONE_COLORS[3]);
  assert.strictEqual(out[1].color, ZONE_COLORS[1]);
  assert.strictEqual(recolorZone(list, 1, '#000000'), list);
});

test('zonesFor returns the zones of this exact world untouched', () => {
  const list = addZone([], ZONE);
  const [d] = zonesFor(list, WORLD);
  assert.deepStrictEqual(d, { zone: list[0], ...RECT, converted: false });
});

test('zonesFor excludes other seeds, versions and large flags', () => {
  const list = addZone([], ZONE);
  assert.deepStrictEqual(zonesFor(list, { ...WORLD, seed: '9' }), []);
  assert.deepStrictEqual(zonesFor(list, { ...WORLD, mc: 21 }), []);
  assert.deepStrictEqual(zonesFor(list, { ...WORLD, large: true }), []);
});

test('zonesFor converts Overworld zones into the Nether at 1:8', () => {
  const list = addZone([], { ...ZONE, x0: -16, z0: 0, x1: 800, z1: 79 });
  const [d] = zonesFor(list, { ...WORLD, dim: -1 });
  assert.strictEqual(d.converted, true);
  assert.deepStrictEqual([d.x0, d.z0, d.x1, d.z1], [-2, 0, 100, 9]);
});

test('zonesFor converts Nether zones into the Overworld at 8:1', () => {
  const list = addZone([], { ...ZONE, dim: -1 });
  const [d] = zonesFor(list, WORLD);
  assert.deepStrictEqual([d.x0, d.z0, d.x1, d.z1, d.converted], [0, 0, 800, 640, true]);
});

test('zonesFor never converts from or into the End', () => {
  const endZone = addZone([], { ...ZONE, dim: 1 });
  assert.deepStrictEqual(zonesFor(endZone, WORLD), []);
  assert.strictEqual(zonesFor(endZone, { ...WORLD, dim: 1 }).length, 1);
  const owZone = addZone([], ZONE);
  assert.deepStrictEqual(zonesFor(owZone, { ...WORLD, dim: 1 }), []);
  const netherZone = addZone([], { ...ZONE, dim: -1 });
  assert.deepStrictEqual(zonesFor(netherZone, { ...WORLD, dim: 1 }), []);
});

test('parseZones round-trips a serialized list', () => {
  const list = addZone(addZone([], ZONE), { ...ZONE, dim: -1, name: 'nether hub' });
  assert.deepStrictEqual(parseZones(JSON.stringify(list)), list);
});

test('parseZones rejects garbage payloads outright', () => {
  assert.deepStrictEqual(parseZones(null), []);
  assert.deepStrictEqual(parseZones('not json'), []);
  assert.deepStrictEqual(parseZones('{"a":1}'), []);
});

test('parseZones drops malformed entries and keeps the first id', () => {
  const ok = { id: 1, ...WORLD, ...RECT, name: 'ok', color: ZONE_COLORS[2] };
  const bad = [
    null, 42,
    { ...ok, id: 0 }, { ...ok, id: 1.5 },
    { ...ok, mc: 'x' },
    { ...ok, dim: 9 },
    { ...ok, x1: 'NaN' },
    { ...ok, seed: {} },
    { ...ok, name: '   ' },
    { ...ok, name: null },
    { ...ok, x1: 0, z1: 0 }
  ];
  const out = parseZones(JSON.stringify([ok, ...bad, { ...ok, name: 'dup id' }]));
  assert.deepStrictEqual(out, [ok]);
});

test('parseZones normalizes numeric seeds, corner order and colors', () => {
  const raw = [{ id: 2, seed: 141, mc: 22, large: 1, dim: -1, x0: 50, z0: 40, x1: -10, z1: 0, name: ' hub ', color: 'red' }];
  const [z] = parseZones(JSON.stringify(raw));
  assert.deepStrictEqual(z, {
    id: 2, seed: '141', mc: 22, large: true, dim: -1,
    x0: -10, z0: 0, x1: 50, z1: 40, name: 'hub', color: ZONE_COLORS[0]
  });
});

test('parseZones ignores entries beyond the cap', () => {
  const many = Array.from({ length: ZONE_MAX + 20 }, (_, i) => ({
    id: i + 1, ...WORLD, ...RECT, x1: 200 + i, name: 'z' + i, color: ZONE_COLORS[0]
  }));
  assert.strictEqual(parseZones(JSON.stringify(many)).length, ZONE_MAX);
});

test('mergeZones appends with fresh ids and skips exact duplicates', () => {
  const mine = addZone([], ZONE);
  const theirs = parseZones(JSON.stringify([
    { id: 7, ...WORLD, ...RECT, name: 'same spot', color: ZONE_COLORS[4] },
    { id: 8, ...WORLD, x0: 300, z0: 300, x1: 400, z1: 420, name: 'new', color: ZONE_COLORS[4] }
  ]));
  const merged = mergeZones(mine, theirs);
  assert.strictEqual(merged.length, 2);
  assert.deepStrictEqual(merged[0], mine[0]);       // input untouched
  assert.strictEqual(merged[1].id, 2);              // fresh id, not 8
  assert.strictEqual(merged[1].name, 'new');
});
