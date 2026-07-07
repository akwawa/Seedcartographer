'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { tileWorldKey, tileKey, createTileCache, tilesInView } = require('../tilecache.js');

const W = { seed: '141', mc: 28, large: false, dim: 0 };

test('tileWorldKey covers every input that invalidates cached pixels', () => {
  const base = tileWorldKey(W, 60);
  assert.notStrictEqual(tileWorldKey({ ...W, seed: '142' }, 60), base);
  assert.notStrictEqual(tileWorldKey({ ...W, mc: 25 }, 60), base);
  assert.notStrictEqual(tileWorldKey({ ...W, large: true }, 60), base);
  assert.notStrictEqual(tileWorldKey({ ...W, dim: -1 }, 60), base);
  assert.notStrictEqual(tileWorldKey(W, -52), base);
  assert.strictEqual(tileWorldKey({ ...W }, 60), base);
});

test('the cache evicts least-recently-used entries and touch refreshes', () => {
  const c = createTileCache(2);
  const wk = tileWorldKey(W, 60);
  const entry = (x) => ({ key: tileKey(wk, 4, x, 0), worldKey: wk, scale: 4, originX: x, originZ: 0, cols: 10, rows: 10 });
  c.put(entry(0)); c.put(entry(100)); c.put(entry(200));
  assert.strictEqual(c.size(), 2);
  assert.deepStrictEqual(c.entries().map((e) => e.originX), [100, 200]);
  // touching the oldest keeps it on the next overflow
  c.touch(tileKey(wk, 4, 100, 0));
  c.put(entry(300));
  assert.deepStrictEqual(c.entries().map((e) => e.originX), [100, 300]);
  // re-putting an existing key replaces without growing
  c.put(entry(300));
  assert.strictEqual(c.size(), 2);
  c.clear();
  assert.strictEqual(c.size(), 0);
});

test('tilesInView filters by world and intersection, paints coarse first', () => {
  const wk = tileWorldKey(W, 60), other = tileWorldKey(W, -52);
  const t = (scale, x, z, worldKey = wk) => ({ worldKey, scale, originX: x, originZ: z, cols: 100, rows: 100 });
  const entries = [
    t(16, 0, 0),          // coarse, oldest
    t(4, 0, 0),           // fine, same spot
    t(4, 10000, 0),       // out of view
    t(4, 0, 0, other),    // other world (different Y layer)
    t(16, -1600, -1600)   // coarse, touches the view corner
  ];
  const rect = { x0: -100, z0: -100, x1: 500, z1: 500 };
  const picked = tilesInView(entries, wk, rect);
  assert.deepStrictEqual(picked.map((e) => [e.scale, e.originX]), [[16, 0], [16, -1600], [4, 0]]);
  // an entry only grazing the rect edge (exclusive bound) is skipped
  const edge = tilesInView([t(4, 500, 0)], wk, rect);
  assert.deepStrictEqual(edge, []);
});
