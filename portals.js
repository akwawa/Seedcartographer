// portals.js — pure logic for the Nether portal calculator (#284): exact
// Minecraft Java coordinate scaling (÷8 / ×8, floored like the game),
// portal-linking search radii and round-trip drift. Shared between app.js
// (ES module import) and the Node test suite.

// Overworld <-> Nether scale factor (Java's DimensionType coordinate scale).
export const NETHER_SCALE = 8;
// When entering a portal, Java searches for an existing portal around the
// ideal destination: 128 blocks in the Overworld, 16 in the Nether.
export const LINK_RADIUS_OVERWORLD = 128;
export const LINK_RADIUS_NETHER = 16;
// Farthest reachable coordinate (world border); scaled destinations are
// clamped inside it, exactly like the game clamps the teleport target.
export const PORTAL_LIMIT = 29999984;

// Dimension linked through portals, or null (the End has no portal pair).
/**
 * @param {number} dim source dimension (0 Overworld, -1 Nether, 1 End)
 * @returns {number|null} destination dimension
 */
export function linkedPortalDim(dim) {
  if (dim === 0) return -1;
  if (dim === -1) return 0;
  return null;
}

/** @param {number} v @returns {number} v clamped inside the world border */
function clampToBorder(v) {
  return Math.max(-PORTAL_LIMIT, Math.min(PORTAL_LIMIT, v));
}

// Java scales the position as a double, clamps it to the world border, then
// takes the containing block (floor) — reproduced exactly here.
/**
 * @param {number} dim source dimension (0 Overworld, -1 Nether, 1 End)
 * @param {number} x block X in the source dimension
 * @param {number} z block Z in the source dimension
 * @returns {{dim: number, x: number, z: number}|null} ideal portal spot in
 *          the linked dimension, or null when there is none (End)
 */
export function idealDestination(dim, x, z) {
  const dest = linkedPortalDim(dim);
  if (dest === null) return null;
  const scale = dim === 0 ? 1 / NETHER_SCALE : NETHER_SCALE;
  return { dim: dest, x: Math.floor(clampToBorder(x * scale)), z: Math.floor(clampToBorder(z * scale)) };
}

// Radius (in blocks of the destination dimension) the game scans for an
// existing portal around the ideal destination.
/**
 * @param {number} destDim destination dimension (0 Overworld, -1 Nether)
 * @returns {number} portal-search radius in blocks
 */
export function linkRadius(destDim) {
  return destDim === 0 ? LINK_RADIUS_OVERWORLD : LINK_RADIUS_NETHER;
}

// Full plan for a portal placed at (x, z) in `dim`: the source, the ideal
// linked destination and the search radius applied around that destination.
/**
 * @param {number} dim source dimension (0 Overworld, -1 Nether, 1 End)
 * @param {number} x block X in the source dimension
 * @param {number} z block Z in the source dimension
 * @returns {{src: {dim: number, x: number, z: number},
 *            dest: {dim: number, x: number, z: number},
 *            radius: number}|null} plan, or null for the End
 */
export function portalPlan(dim, x, z) {
  const dest = idealDestination(dim, x, z);
  if (!dest) return null;
  return { src: { dim, x, z }, dest, radius: linkRadius(dest.dim) };
}

// Round trip: where the game aims when coming back through the ideal
// destination, and the drift (blocks) from the original spot — up to 7
// blocks per axis Overworld->Nether->Overworld because of the ÷8 floor.
/**
 * @param {number} dim source dimension (0 Overworld, -1 Nether, 1 End)
 * @param {number} x block X in the source dimension
 * @param {number} z block Z in the source dimension
 * @returns {{back: {dim: number, x: number, z: number},
 *            dx: number, dz: number}|null} round-trip spot and drift
 */
export function portalRoundTrip(dim, x, z) {
  const dest = idealDestination(dim, x, z);
  if (!dest) return null;
  const back = idealDestination(dest.dim, dest.x, dest.z);
  return { back, dx: Math.abs(back.x - x), dz: Math.abs(back.z - z) };
}
