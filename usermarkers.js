// usermarkers.js — free named pins placed anywhere on the map, independent
// of search results. Pure list operations, shared between app.js (script
// tag, backed by localStorage) and the Node test suite (require). No data
// ever leaves the browser except through the explicit JSON export.

export const MARKER_MAX = 200;       // sanity cap so localStorage cannot grow unbounded
export const MARKER_NAME_MAX = 60;   // display cap for free-text names

// a marker is bound to the exact world it was placed in, like a favorite
/**
 * @typedef {{id: number, seed: string, mc: number, large: boolean, dim: number,
 *            x: number, z: number, name: string}} UserMarker
 */

/** @param {UserMarker[]} list @returns {number} smallest unused positive id */
function nextMarkerId(list) {
  return list.reduce((m, p) => Math.max(m, p.id), 0) + 1;
}

// returns a new list; refuses duplicates (same world + same spot) and
// silently drops the add beyond the cap
/**
 * @param {UserMarker[]} list current markers
 * @param {{seed: string|number, mc: number, large: boolean, dim: number,
 *          x: number, z: number, name?: string}} m marker to place
 * @returns {UserMarker[]} new list (input untouched)
 */
export function addMarker(list, m) {
  if (list.length >= MARKER_MAX) return list;
  if (list.some((e) => sameMarkerWorld(e, m) && e.x === m.x && e.z === m.z)) return list;
  const name = String(m.name ?? '').trim().slice(0, MARKER_NAME_MAX) || `#${nextMarkerId(list)}`;
  return [...list, {
    id: nextMarkerId(list), seed: String(m.seed), mc: m.mc, large: !!m.large,
    dim: m.dim, x: m.x, z: m.z, name
  }];
}

/** @param {UserMarker[]} list @param {number} id @returns {UserMarker[]} */
export function removeMarker(list, id) {
  return list.filter((m) => m.id !== id);
}

/** @param {UserMarker[]} list @param {number} id @param {string} name @returns {UserMarker[]} */
export function renameMarker(list, id, name) {
  const n = String(name ?? '').trim().slice(0, MARKER_NAME_MAX);
  return list.map((m) => (m.id === id && n ? { ...m, name: n } : m));
}

/** @param {UserMarker} a @param {{seed: string|number, mc: number, large: boolean, dim: number}} b @returns {boolean} */
function sameMarkerWorld(a, b) {
  return String(a.seed) === String(b.seed) && a.mc === b.mc && !!a.large === !!b.large && a.dim === b.dim;
}

/**
 * @param {UserMarker[]} list
 * @param {{seed: string|number, mc: number, large: boolean, dim: number}} world
 * @returns {UserMarker[]} markers placed in this exact world
 */
export function markersFor(list, world) {
  return list.filter((m) => sameMarkerWorld(m, world));
}

/** @param {any} m candidate entry @returns {UserMarker|null} */
function normalizeMarker(m) {
  if (!m || typeof m !== 'object') return null;
  const id = Number(m.id), mc = Number(m.mc), dim = Number(m.dim), x = Number(m.x), z = Number(m.z);
  const name = String(m.name ?? '').trim().slice(0, MARKER_NAME_MAX);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(mc)) return null;
  if (![0, -1, 1].includes(dim) || !Number.isFinite(x) || !Number.isFinite(z) || !name) return null;
  if (typeof m.seed !== 'string' && typeof m.seed !== 'number') return null;
  return { id, seed: String(m.seed), mc, large: !!m.large, dim, x: Math.round(x), z: Math.round(z), name };
}

// localStorage and imported files are outside the app's control: only
// well-formed entries survive (first id wins)
/**
 * @param {string|null} json raw payload
 * @returns {UserMarker[]} well-formed markers only
 */
export function parseMarkers(json) {
  let raw;
  try { raw = JSON.parse(String(json)); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const byId = new Map();
  for (const m of raw.slice(0, MARKER_MAX)) {
    const mk = normalizeMarker(m);
    if (mk && !byId.has(mk.id)) byId.set(mk.id, mk);
  }
  return [...byId.values()];
}

// import: append the imported markers with fresh ids, skipping exact
// duplicates (same world + same spot), capped like every add
/**
 * @param {UserMarker[]} list current markers
 * @param {UserMarker[]} imported parsed import payload
 * @returns {UserMarker[]} merged list (input untouched)
 */
export function mergeMarkers(list, imported) {
  let out = list;
  for (const m of imported) out = addMarker(out, m);
  return out;
}
