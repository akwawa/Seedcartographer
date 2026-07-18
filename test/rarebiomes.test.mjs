import test from 'node:test';
import assert from 'node:assert';
import {
  RARE_BIOMES, RARE_RING_BLOCKS, RARE_MAX_RADIUS,
  rareRingCount, ringRects, nearestMatch, rareSearchDone, rareHit
} from '../rarebiomes.js';

test('RARE_BIOMES lists distinct ids and engine-style names', () => {
  assert.ok(RARE_BIOMES.length >= 6);
  const ids = RARE_BIOMES.map((b) => b.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const b of RARE_BIOMES) {
    assert.ok(Number.isInteger(b.id) && b.id >= 0);
    assert.match(b.name, /^[a-z_]+$/);
  }
  // the biomes named by the ticket are all present
  for (const name of ['mushroom_fields', 'badlands', 'cherry_grove', 'ice_spikes', 'jungle', 'mangrove_swamp']) {
    assert.ok(RARE_BIOMES.some((b) => b.name === name), `missing ${name}`);
  }
});

test('rareRingCount covers the bound with the defaults and explicit values', () => {
  assert.strictEqual(rareRingCount(), RARE_MAX_RADIUS / RARE_RING_BLOCKS);
  assert.strictEqual(rareRingCount(2048, 1024), 2);
  assert.strictEqual(rareRingCount(2500, 1024), 3);   // partial ring rounds up
  assert.strictEqual(rareRingCount(0, 1024), 1);      // never less than one ring
});

test('ringRects: ring 0 is the full central square', () => {
  assert.deepStrictEqual(ringRects(0, 4), [{ ci0: -4, cj0: -4, cols: 9, rows: 9 }]);
});

test('ringRects: outer rings tile the frame exactly, without overlap', () => {
  const half = 3;
  for (const k of [1, 2]) {
    const rects = ringRects(k, half);
    assert.strictEqual(rects.length, 4);
    const outer = (k + 1) * half, inner = k * half;
    const seen = new Set();
    for (const r of rects) {
      for (let j = 0; j < r.rows; j++) {
        for (let i = 0; i < r.cols; i++) {
          const ci = r.ci0 + i, cj = r.cj0 + j;
          const key = ci + ',' + cj;
          assert.ok(!seen.has(key), `overlap at ${key}`);
          seen.add(key);
          const cheb = Math.max(Math.abs(ci), Math.abs(cj));
          assert.ok(cheb > inner && cheb <= outer, `cell ${key} outside frame ${k}`);
        }
      }
    }
    // every cell of the frame is covered
    assert.strictEqual(seen.size, (2 * outer + 1) ** 2 - (2 * inner + 1) ** 2);
  }
});

test('nearestMatch finds the cell closest to the center', () => {
  // 3x3 rect whose NW corner sits at (-1,-1): center cell is index 4
  const grid = [7, 0, 7, 0, 0, 0, 0, 0, 7];
  const best = nearestMatch(grid, 3, 3, -1, -1, 7, null);
  assert.deepStrictEqual(best, { ci: -1, cj: -1, d2: 2 });
});

test('nearestMatch keeps a better previous best and improves a worse one', () => {
  const grid = [0, 0, 0, 0, 5, 0, 0, 0, 0];   // match at the center cell
  const far = { ci: 10, cj: 0, d2: 100 };
  assert.deepStrictEqual(nearestMatch(grid, 3, 3, -1, -1, 5, far), { ci: 0, cj: 0, d2: 0 });
  const near = { ci: 0, cj: 0, d2: 0 };
  const offCenter = [5, 0, 0, 0, 0, 0, 0, 0, 0];
  assert.strictEqual(nearestMatch(offCenter, 3, 3, -1, -1, 5, near), near);
});

test('nearestMatch returns the previous best when nothing matches', () => {
  const grid = [0, 0, 0, 0];
  assert.strictEqual(nearestMatch(grid, 2, 2, 0, 0, 9, null), null);
  const prev = { ci: 1, cj: 1, d2: 2 };
  assert.strictEqual(nearestMatch(grid, 2, 2, 0, 0, 9, prev), prev);
});

test('rareSearchDone stops only once no unexplored cell can be closer', () => {
  assert.strictEqual(rareSearchDone(null, 0, 64), false);
  // hit inside ring 0's inscribed circle: done immediately
  assert.strictEqual(rareSearchDone({ d2: 64 * 64 }, 0, 64), true);
  // corner hit of ring 0: a ring-1 cell could still be closer
  assert.strictEqual(rareSearchDone({ d2: 2 * 64 * 64 }, 0, 64), false);
  // …but after ring 1 it is provably the nearest
  assert.strictEqual(rareSearchDone({ d2: 2 * 64 * 64 }, 1, 64), true);
});

test('rareHit converts center-relative cells to world blocks', () => {
  assert.deepStrictEqual(rareHit({ ci: -3, cj: 2 }, 10, -5, 16), { x: 112, z: -48 });
});
