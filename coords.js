// coords.js — dimension coordinate conversions (Overworld <-> Nether, 1:8).
// Shared between app.js (script tag) and the Node test suite (require).

// Equivalent coordinates in the linked dimension, or null for the End.
// dim: 0 = Overworld, -1 = Nether, 1 = End.
/**
 * @param {number} dim source dimension (0 Overworld, -1 Nether, 1 End)
 * @param {number} x block X in the source dimension
 * @param {number} z block Z in the source dimension
 * @returns {{label: string, x: number, z: number}|null} linked-dimension
 *          coordinates, or null when the dimension has no counterpart (End)
 */
export function convertCoords(dim, x, z) {
  if (dim === 0) return { label: 'Nether', x: Math.floor(x / 8), z: Math.floor(z / 8) };
  if (dim === -1) return { label: 'Overworld', x: x * 8, z: z * 8 };
  return null;
}
