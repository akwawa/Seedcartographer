// presets.js — built-in search-criteria presets. Pure data + mapping, shared
// between app.js (script tag) and the Node test suite (require).
//
// A preset stores criteria in the share-link `c` shape (see readCriteria in
// app.js), except structure clauses reference the STABLE structure index
// (`si`, the order of structDefs/structToggles) instead of the engine enum
// value, which is only known at runtime: presetCriteria() resolves them.
'use strict';

// biome ids are the cubiomes enum values (cubiomes/biomes.h)
const PRESETS = [
  {
    id: 'cherry-ocean',
    labelKey: 'presetCherryOcean',
    // the built-in demo: cherry grove touching a warm ocean, 2+ villages
    c: { mb: [185], am: 'and', ac: [{ b: 44, d: 400, n: 0 }], sm: 'and', sc: [{ si: 0, mn: 2, r: 800 }], rg: 5000, sp: 16 }
  },
  {
    id: 'village-outpost',
    labelKey: 'presetVillageOutpost',
    // a village with a pillager outpost close by, in any village biome
    c: {
      mb: [1, 2, 5, 12, 35], am: 'and', ac: [], sm: 'and',
      sc: [{ si: 0, mn: 1, r: 300 }, { si: 1, mn: 1, r: 300 }], rg: 5000, sp: 32
    }
  },
  {
    id: 'mushroom',
    labelKey: 'presetMushroom',
    // mushroom fields are rare: wide radius, coarse step
    c: { mb: [14], am: 'and', ac: [], sm: 'and', sc: [], rg: 10000, sp: 64 }
  },
  {
    id: 'slime-farm',
    labelKey: 'presetSlimeFarm',
    // flat land with several slime chunks in despawn-sphere reach
    c: { mb: [1], am: 'and', ac: [], sm: 'and', sc: [{ si: 19, mn: 3, r: 128 }], rg: 3000, sp: 16 }
  }
];

// Resolve a preset to the share-link criteria shape. `structTypes` maps the
// stable structure index to the engine enum value (structToggles order);
// clauses whose index is unknown are dropped rather than mislabelled.
function presetCriteria(preset, structTypes) {
  const { mb, am, ac, sm, rg, sp } = preset.c;
  const sc = preset.c.sc
    .filter((s) => Number.isInteger(structTypes[s.si]))
    .map((s) => ({ t: structTypes[s.si], mn: s.mn, r: s.r }));
  return { mb: [...mb], am, ac: ac.map((a) => ({ ...a })), sm, sc, rg, sp };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PRESETS, presetCriteria };
}
