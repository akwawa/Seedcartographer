// Property-based tests (#280): fast-check generates arbitrary inputs for the
// pure modules and checks invariants instead of hand-picked examples. The
// fast-check seed is fixed so CI runs are deterministic and reproducible.
import test from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';
import { seedToBigInt } from '../seed.js';
import { keyAction } from '../keys.js';
import { COMPARE_MIN_BPP, COMPARE_MAX_BPP, panViewport, zoomViewportAt } from '../compare.js';
import { addZone, ZONE_COORD_LIMIT } from '../userzones.js';

// same generated values on every run, everywhere
const FC = { seed: 280, numRuns: 200 };

const INT64_MIN = -(2n ** 63n), INT64_MAX = 2n ** 63n - 1n;
const INT32_MIN = -0x80000000, INT32_MAX = 0x7FFFFFFF;

test('seedToBigInt: numeric strings round-trip to the same signed 64-bit value', () => {
  fc.assert(fc.property(fc.bigInt({ min: INT64_MIN, max: INT64_MAX }), (n) => {
    assert.strictEqual(seedToBigInt(String(n)), n);
    // whitespace around the number is ignored
    assert.strictEqual(seedToBigInt(`  ${n} `), n);
  }), FC);
});

test('seedToBigInt: any string yields a stable signed 32-bit hash', () => {
  fc.assert(fc.property(fc.string({ unit: 'binary' }), (s) => {
    const h = seedToBigInt(s);
    // deterministic: hashing twice gives the same seed
    assert.strictEqual(seedToBigInt(s), h);
    // a Java String.hashCode always fits a signed 32-bit int
    assert.ok(h >= BigInt(INT32_MIN) && h <= BigInt(INT32_MAX), `${s} -> ${h}`);
  }), FC);
});

const KNOWN_ACTIONS = new Set([
  'skip-tour', 'close', 'search', 'zoom-in', 'zoom-out', 'goto', 'ruler', 'help'
]);

const arbKeyContext = fc.record({
  key: fc.oneof(fc.string(), fc.constantFrom('Escape', 'Enter', '+', '-', 'g', 'r', '?')),
  mod: fc.boolean(),
  inInput: fc.boolean(),
  inSearchField: fc.boolean(),
  tourOpen: fc.boolean(),
  dialogOpen: fc.boolean()
});

test('keyAction: never throws, always returns a known action or null', () => {
  fc.assert(fc.property(arbKeyContext, (ctx) => {
    const a = keyAction(ctx);
    assert.ok(a === null || KNOWN_ACTIONS.has(a), `unexpected action ${a}`);
    // a held browser modifier always wins
    if (ctx.mod) assert.strictEqual(a, null);
  }), FC);
});

// power-of-two zooms and integer coordinates keep the floating-point
// arithmetic exact, so the invariants can use strict equality
const arbBpp = fc.integer({ min: -1, max: 9 }).map((e) => 2 ** e); // 0.5 .. 512
const arbCoord = fc.integer({ min: -1e6, max: 1e6 });
const arbView = fc.record({ cx: arbCoord, cz: arbCoord, bpp: arbBpp });

test('panViewport: panning back by the opposite delta restores the viewport', () => {
  fc.assert(fc.property(arbView, fc.integer({ min: -2000, max: 2000 }), fc.integer({ min: -2000, max: 2000 }), (view, dx, dy) => {
    const back = panViewport(panViewport(view, dx, dy), -dx, -dy);
    // spread: fc.record builds null-prototype objects, panViewport plain ones
    assert.deepStrictEqual({ ...back }, { ...view });
    // zoom is never affected by a pan
    assert.strictEqual(panViewport(view, dx, dy).bpp, view.bpp);
  }), FC);
});

test('zoomViewportAt: the world point under the cursor stays fixed', () => {
  const arbSize = fc.integer({ min: 1, max: 1024 }).map((n) => 2 * n); // even sizes: w/2 exact
  fc.assert(fc.property(
    arbView, arbSize, arbSize, fc.integer({ min: 0, max: 2048 }), fc.integer({ min: 0, max: 2048 }),
    fc.constantFrom(0.5, 2),
    (view, w, h, mx, my, factor) => {
      const next = zoomViewportAt(view, w, h, mx, my, factor);
      // zoom stays inside the supported range
      assert.ok(next.bpp >= COMPARE_MIN_BPP && next.bpp <= COMPARE_MAX_BPP);
      // the anchor maps to the same world point before and after
      const before = { x: view.cx + (mx - w / 2) * view.bpp, z: view.cz + (my - h / 2) * view.bpp };
      const after = { x: next.cx + (mx - w / 2) * next.bpp, z: next.cz + (my - h / 2) * next.bpp };
      assert.deepStrictEqual(after, before);
    }
  ), FC);
});

const arbZoneInput = fc.record({
  seed: fc.string(), mc: fc.integer({ min: 0, max: 30 }), large: fc.boolean(), dim: fc.constantFrom(0, -1, 1),
  x0: fc.double({ min: -4e7, max: 4e7, noNaN: true }),
  z0: fc.double({ min: -4e7, max: 4e7, noNaN: true }),
  x1: fc.double({ min: -4e7, max: 4e7, noNaN: true }),
  z1: fc.double({ min: -4e7, max: 4e7, noNaN: true }),
  name: fc.string(), color: fc.string()
});

test('addZone: never stores a degenerate rectangle and never mutates its input', () => {
  fc.assert(fc.property(fc.array(arbZoneInput, { maxLength: 3 }), arbZoneInput, (seedZones, z) => {
    const list = seedZones.reduce((acc, s) => addZone(acc, s), []);
    const snapshot = structuredClone(list);
    const next = addZone(list, z);
    // the input list is returned as-is or copied, never mutated
    assert.deepStrictEqual(list, snapshot);
    assert.ok(next.length === list.length || next.length === list.length + 1);
    for (const e of next) {
      // strictly ordered corners: no line, no point, clamped to the border
      assert.ok(e.x0 < e.x1 && e.z0 < e.z1, `degenerate rect ${JSON.stringify(e)}`);
      assert.ok(Math.abs(e.x0) <= ZONE_COORD_LIMIT && Math.abs(e.x1) <= ZONE_COORD_LIMIT);
      assert.ok(Math.abs(e.z0) <= ZONE_COORD_LIMIT && Math.abs(e.z1) <= ZONE_COORD_LIMIT);
      assert.ok(e.name.length > 0);
    }
    // ids are unique within a list
    assert.strictEqual(new Set(next.map((e) => e.id)).size, next.length);
  }), FC);
});
