import test from 'node:test';
import assert from 'node:assert';
import {
  mapCartoucheLines, exportFileName,
  hdExportScale, hdExportGeometry, hdCellSpan, hdCellIndex, cartoucheMetrics,
  EXPORT_MAX_PIXELS
} from '../export.js';

test('cartouche lines describe seed, version, dimension and center', () => {
  const lines = mapCartoucheLines({
    seed: 'my seed', mcLabel: '1.21', large: false, dimension: 'Nether', cx: -48, cz: 12
  });
  assert.deepStrictEqual(lines, [
    'Seed: my seed',
    'Java 1.21 — Nether',
    'Center: -48, 12'
  ]);
});

test('Large Biomes worlds are flagged in the cartouche', () => {
  const lines = mapCartoucheLines({
    seed: '141', mcLabel: '1.18', large: true, dimension: 'Overworld', cx: 0, cz: 0
  });
  assert.strictEqual(lines[1], 'Java 1.18 (Large Biomes) — Overworld');
});

// ---- high-resolution export geometry (#231) ----

test('hdExportScale picks the smallest cubiomes scale covering the pixel size', () => {
  assert.strictEqual(hdExportScale(0.5), 4);
  assert.strictEqual(hdExportScale(4), 4);
  assert.strictEqual(hdExportScale(10), 16);
  assert.strictEqual(hdExportScale(50), 64);
  assert.strictEqual(hdExportScale(200), 256);
});

test('hdExportGeometry keeps the viewport aspect and world extents', () => {
  const g = hdExportGeometry({ cx: 100, cz: -50, bpp: 2 }, 1000, 500, 2048);
  assert.strictEqual(g.outW, 2048);
  assert.strictEqual(g.outH, 1024);            // same 2:1 aspect
  // world width shown on screen: 1000 px * 2 bpp = 2000 blocks
  assert.ok(Math.abs(g.bppOut - 2000 / 2048) < 1e-12);
  assert.ok(Math.abs(g.wx0 - (100 - 1000)) < 1e-9);
  assert.ok(Math.abs(g.wz0 - (-50 - 512 * g.bppOut)) < 1e-9);
  assert.strictEqual(g.scale, 4);
});

test('hdExportGeometry clamps the output height to at least one pixel', () => {
  const g = hdExportGeometry({ cx: 0, cz: 0, bpp: 1 }, 10000, 1, 2048);
  assert.strictEqual(g.outH, 1);
});

test('hdExportGeometry returns null past the memory guard', () => {
  assert.strictEqual(hdExportGeometry({ cx: 0, cz: 0, bpp: 1 }, 100, 100, 8192, 1000), null);
  // the default guard admits a 4096 px square export
  assert.ok(hdExportGeometry({ cx: 0, cz: 0, bpp: 1 }, 100, 100, 4096) !== null);
  assert.ok(EXPORT_MAX_PIXELS >= 4096 * 4096);
});

test('hdCellSpan and hdCellIndex agree on the covered cell grid', () => {
  const wx0 = -13.5, bpp = 0.75, scale = 4, extent = 640;
  const span = hdCellSpan(wx0, extent, bpp, scale);
  const first = hdCellIndex(0, wx0, bpp, scale);
  const last = hdCellIndex(extent - 1, wx0, bpp, scale);
  assert.strictEqual(span.c0, Math.floor(wx0 / scale));
  assert.ok(first >= span.c0);
  assert.strictEqual(last, span.c0 + span.count - 1);
});

test('cartouche metrics scale proportionally and never shrink below screen size', () => {
  const base = cartoucheMetrics(1024);
  assert.deepStrictEqual(base, { band: 64, font: 12, padX: 10, baseline: 18, lineStep: 17 });
  // small exports keep the on-screen sizing instead of shrinking the text
  assert.deepStrictEqual(cartoucheMetrics(512), base);
  const hd = cartoucheMetrics(4096);
  assert.deepStrictEqual(hd, { band: 256, font: 48, padX: 40, baseline: 72, lineStep: 68 });
});

test('export file names sanitize the seed', () => {
  assert.strictEqual(exportFileName('141', 'map', 'png'), 'seedcartographer-141-map.png');
  assert.strictEqual(exportFileName('mon île !', 'map', 'png'), 'seedcartographer-mon_le_-map.png');
  assert.strictEqual(exportFileName(-7799461267186613798n, 'map', 'png'),
    'seedcartographer--7799461267186613798-map.png');
});
