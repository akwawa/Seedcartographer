// markers.js — synthetic "structure" type ids for world markers that are not
// cubiomes structure enums: the worker routes them to dedicated engine calls
// (spawn point, strongholds) instead of listStructures. Shared between app.js,
// worker.js and the Node test suite (ES module). Must never
// collide with a cubiomes StructureType value nor with SLIME_STRUCT_TYPE (-2).

const SPAWN_STRUCT_TYPE = -3;
const STRONGHOLD_STRUCT_TYPE = -4;
const QUADHUT_STRUCT_TYPE = -5;

export { SPAWN_STRUCT_TYPE, STRONGHOLD_STRUCT_TYPE, QUADHUT_STRUCT_TYPE };
