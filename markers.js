// markers.js — synthetic "structure" type ids for world markers that are not
// cubiomes structure enums: the worker routes them to dedicated engine calls
// (spawn point, strongholds) instead of listStructures. Shared between app.js,
// worker.js (importScripts) and the Node test suite (require). Must never
// collide with a cubiomes StructureType value nor with SLIME_STRUCT_TYPE (-2).
'use strict';

const SPAWN_STRUCT_TYPE = -3;
const STRONGHOLD_STRUCT_TYPE = -4;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SPAWN_STRUCT_TYPE, STRONGHOLD_STRUCT_TYPE };
}
