// coords.js — dimension coordinate conversions (Overworld <-> Nether, 1:8).
// Shared between app.js (script tag) and the Node test suite (require).
'use strict';

// Equivalent coordinates in the linked dimension, or null for the End.
// dim: 0 = Overworld, -1 = Nether, 1 = End.
function convertCoords(dim, x, z) {
  if (dim === 0) return { label: 'Nether', x: Math.floor(x / 8), z: Math.floor(z / 8) };
  if (dim === -1) return { label: 'Overworld', x: x * 8, z: z * 8 };
  return null;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { convertCoords };
