import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { test } from 'node:test';
import assert from 'node:assert';
const { TILE_CELLS, renderScaleFor, tilesForView, unionPresent } = require('../tilegrid.js');

test('renderScaleFor mirrors the worker scale ladder', () => {
  assert.strictEqual(renderScaleFor(0.5), 4);
  assert.strictEqual(renderScaleFor(4), 4);
  assert.strictEqual(renderScaleFor(5), 16);
  assert.strictEqual(renderScaleFor(64), 64);
  assert.strictEqual(renderScaleFor(300), 256);
});

test('tilesForView covers the viewport with world-aligned tiles', () => {
  const scale = 16, span = TILE_CELLS * scale;   // 4096 blocks
  const view = { cx: 100, cz: -50, bpp: 16 };
  const tiles = tilesForView(view, 800, 600, scale);   // 12800×9600 blocks
  assert.ok(tiles.length >= 4 && tiles.length <= 20);
  const x0 = view.cx - 400 * 16, x1 = view.cx + 400 * 16;
  const z0 = view.cz - 300 * 16, z1 = view.cz + 300 * 16;
  for (const t of tiles) {
    // aligned on the span grid
    assert.strictEqual(((t.originX % span) + span) % span, 0);
    assert.strictEqual(((t.originZ % span) + span) % span, 0);
    // intersects the viewport
    assert.ok(t.originX < x1 && t.originX + span > x0);
    assert.ok(t.originZ < z1 && t.originZ + span > z0);
  }
  // every viewport corner is covered by some tile
  for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) {
    assert.ok(tiles.some((t) => px >= t.originX && px < t.originX + span
      && pz >= t.originZ && pz < t.originZ + span));
  }
});

test('tilesForView orders tiles center-first', () => {
  const scale = 16, span = TILE_CELLS * scale;
  const view = { cx: 0, cz: 0, bpp: 16 };
  const tiles = tilesForView(view, 800, 600, scale);
  const d2 = (t) => (t.originX + span / 2) ** 2 + (t.originZ + span / 2) ** 2;
  for (let i = 1; i < tiles.length; i++) assert.ok(d2(tiles[i]) >= d2(tiles[i - 1]));
});

test('unionPresent merges the per-tile biome sets', () => {
  assert.deepStrictEqual(
    unionPresent([{ present: [1, 2] }, { present: [2, 3] }, {}]).sort((a, b) => a - b),
    [1, 2, 3]
  );
  assert.deepStrictEqual(unionPresent([]), []);
});
