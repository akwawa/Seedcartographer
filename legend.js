// legend.js — biome legend entries for the ids visible in the current tile.
// Pure, shared between app.js (script tag) and the Node test suite (require).
'use strict';

// present: iterable of biome ids seen in the rendered tile
// biomes:  [{id, name, rgb:[r,g,b], …}] from the engine's biomeList
// label:   name -> localized label (biomeLabel)
// Returns unique known biomes, sorted by localized label.
function legendEntries(present, biomes, label) {
  const byId = new Map(biomes.map((b) => [b.id, b]));
  return [...new Set(present)]
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((b) => ({ id: b.id, name: b.name, rgb: b.rgb, label: label(b.name) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { legendEntries };
}
