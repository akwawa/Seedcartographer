import test from 'node:test';
import assert from 'node:assert';
import {
  NETHER_SCALE, LINK_RADIUS_OVERWORLD, LINK_RADIUS_NETHER, PORTAL_LIMIT,
  linkedPortalDim, idealDestination, linkRadius, portalPlan, portalRoundTrip
} from '../portals.js';

test('portals link the Overworld and the Nether, the End links nothing', () => {
  assert.strictEqual(linkedPortalDim(0), -1);
  assert.strictEqual(linkedPortalDim(-1), 0);
  assert.strictEqual(linkedPortalDim(1), null);
});

test('Overworld coordinates divide by 8 with Java flooring (negatives included)', () => {
  assert.deepStrictEqual(idealDestination(0, 800, -1600), { dim: -1, x: 100, z: -200 });
  // floor, not trunc: -15 / 8 -> -2 like BlockPos.containing
  assert.deepStrictEqual(idealDestination(0, 15, -15), { dim: -1, x: 1, z: -2 });
});

test('Nether coordinates multiply by 8 exactly', () => {
  assert.deepStrictEqual(idealDestination(-1, -1968, 250), { dim: 0, x: -15744, z: 2000 });
});

test('scaled destinations are clamped inside the world border', () => {
  assert.deepStrictEqual(idealDestination(-1, 29999984, -29999984),
    { dim: 0, x: PORTAL_LIMIT, z: -PORTAL_LIMIT });
});

test('the End has no ideal destination or plan', () => {
  assert.strictEqual(idealDestination(1, 100, 100), null);
  assert.strictEqual(portalPlan(1, 100, 100), null);
  assert.strictEqual(portalRoundTrip(1, 100, 100), null);
});

test('the portal-search radius is 128 in the Overworld, 16 in the Nether', () => {
  assert.strictEqual(linkRadius(0), LINK_RADIUS_OVERWORLD);
  assert.strictEqual(linkRadius(-1), LINK_RADIUS_NETHER);
  assert.strictEqual(LINK_RADIUS_OVERWORLD, 128);
  assert.strictEqual(LINK_RADIUS_NETHER, 16);
});

test('a plan carries the source, the ideal destination and its radius', () => {
  assert.deepStrictEqual(portalPlan(0, 800, -1600), {
    src: { dim: 0, x: 800, z: -1600 },
    dest: { dim: -1, x: 100, z: -200 },
    radius: LINK_RADIUS_NETHER
  });
  assert.deepStrictEqual(portalPlan(-1, 100, -200), {
    src: { dim: -1, x: 100, z: -200 },
    dest: { dim: 0, x: 800, z: -1600 },
    radius: LINK_RADIUS_OVERWORLD
  });
});

test('round trip from the Nether is exact, from the Overworld drifts up to 7 blocks', () => {
  assert.deepStrictEqual(portalRoundTrip(-1, 100, -200),
    { back: { dim: -1, x: 100, z: -200 }, dx: 0, dz: 0 });
  // 807 -> floor(807/8)=100 -> 800: 7-block drift on X
  assert.deepStrictEqual(portalRoundTrip(0, 807, -1600),
    { back: { dim: 0, x: 800, z: -1600 }, dx: 7, dz: 0 });
});

test('the scale constant matches the game', () => {
  assert.strictEqual(NETHER_SCALE, 8);
});
