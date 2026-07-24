// userpaths.js — named polyline path annotations traced on the map (#285):
// successive clicked waypoints with a cumulative distance in blocks and its
// Nether equivalent (÷8). Pure list operations shared between app.js (backed
// by localStorage) and the Node test suite. No data ever leaves the browser
// except through the explicit profile export / sync code.
import { convertCoords } from './coords.js';

export const PATH_MAX = 100;          // sanity cap so localStorage cannot grow unbounded
export const PATH_NAME_MAX = 60;      // display cap for free-text names
export const PATH_COORD_LIMIT = 29999984;   // Java world border
export const PATH_POINT_MAX = 200;    // waypoints per path

// a path is bound to the exact world it was traced in, like a zone
/**
 * @typedef {{x: number, z: number}} PathPoint
 * @typedef {{id: number, seed: string, mc: number, large: boolean, dim: number,
 *            pts: PathPoint[], name: string}} UserPath
 */

/** @param {UserPath[]} list @returns {number} smallest unused positive id */
function nextPathId(list) {
  return list.reduce((m, p) => Math.max(m, p.id), 0) + 1;
}

/** @param {number} v @returns {number} rounded coordinate inside the world border */
function clampCoord(v) {
  return Math.min(PATH_COORD_LIMIT, Math.max(-PATH_COORD_LIMIT, Math.round(v)));
}

// returns a new list of points; the candidate is rounded and clamped to the
// world border, a repeat of the last waypoint is ignored (double-click ends
// the trace with two clicks on the same spot) and the point cap applies
/**
 * @param {PathPoint[]} pts current waypoints
 * @param {number} x @param {number} z
 * @returns {PathPoint[]} new list (input untouched)
 */
export function appendPathPoint(pts, x, z) {
  if (pts.length >= PATH_POINT_MAX) return pts;
  const p = { x: clampCoord(x), z: clampCoord(z) };
  const last = pts.at(-1);
  if (last?.x === p.x && last?.z === p.z) return pts;
  return [...pts, p];
}

/** @param {PathPoint[]} pts @returns {PathPoint[]} waypoints minus the last one */
export function removeLastPathPoint(pts) {
  return pts.slice(0, -1);
}

// cumulative distance: the sum of the Euclidean segment lengths, in blocks
/** @param {PathPoint[]} pts @returns {number} rounded total distance */
export function pathDistance(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  }
  return Math.round(d);
}

// same distance expressed in the linked dimension (Overworld <-> Nether,
// 1:8), or null for the End which has no counterpart
/**
 * @param {number} dim dimension the distance was measured in
 * @param {number} dist distance in blocks of `dim`
 * @returns {{dim: number, dist: number}|null} linked-dimension equivalent
 */
export function linkedDistance(dim, dist) {
  if (dim === 0) return { dim: -1, dist: Math.round(dist / 8) };
  if (dim === -1) return { dim: 0, dist: dist * 8 };
  return null;
}

// distance from a point to a segment, used by the UI to hit-test polylines
/**
 * @param {number} px @param {number} pz point
 * @param {number} ax @param {number} az segment start
 * @param {number} bx @param {number} bz segment end
 * @returns {number} shortest distance from the point to the segment
 */
export function pointSegmentDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

/**
 * @param {{seed: string|number, mc: number, large: boolean, dim: number}} a
 * @param {{seed: string|number, mc: number, large: boolean, dim: number}} b
 * @returns {boolean}
 */
function samePathWorld(a, b) {
  return String(a.seed) === String(b.seed) && a.mc === b.mc && !!a.large === !!b.large && a.dim === b.dim;
}

/** @param {PathPoint[]} a @param {PathPoint[]} b @returns {boolean} */
function samePoints(a, b) {
  return a.length === b.length && a.every((p, i) => p.x === b[i].x && p.z === b[i].z);
}

// candidate waypoints from outside the app (drag state, localStorage,
// imports): every point must be a finite pair, or the whole path is refused
/** @param {any} raw candidate list @returns {PathPoint[]} normalized waypoints */
function normalizePoints(raw) {
  if (!Array.isArray(raw)) return [];
  /** @type {PathPoint[]} */
  let pts = [];
  for (const p of raw.slice(0, PATH_POINT_MAX)) {
    const x = Number(p?.x), z = Number(p?.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return [];
    pts = appendPathPoint(pts, x, z);
  }
  return pts;
}

// returns a new list; refuses degenerate paths (fewer than 2 distinct
// waypoints) and duplicates (same world + same waypoints), silently drops
// the add beyond the cap — the same contract as addZone
/**
 * @param {UserPath[]} list current paths
 * @param {{seed: string|number, mc: number, large: boolean, dim: number,
 *          pts: PathPoint[], name?: string}} p path to create
 * @returns {UserPath[]} new list (input untouched)
 */
export function addPath(list, p) {
  if (list.length >= PATH_MAX) return list;
  const pts = normalizePoints(p.pts);
  if (pts.length < 2) return list;
  if (list.some((e) => samePathWorld(e, p) && samePoints(e.pts, pts))) return list;
  const name = String(p.name ?? '').trim().slice(0, PATH_NAME_MAX) || `#${nextPathId(list)}`;
  return [...list, {
    id: nextPathId(list), seed: String(p.seed), mc: p.mc, large: !!p.large,
    dim: p.dim, pts, name
  }];
}

/** @param {UserPath[]} list @param {number} id @returns {UserPath[]} */
export function removePath(list, id) {
  return list.filter((p) => p.id !== id);
}

/** @param {UserPath[]} list @param {number} id @param {string} name @returns {UserPath[]} */
export function renamePath(list, id, name) {
  const n = String(name ?? '').trim().slice(0, PATH_NAME_MAX);
  return list.map((p) => (p.id === id && n ? { ...p, name: n } : p));
}

// Paths to display in `world`: those traced in this exact world, plus the
// paths of the linked dimension (Overworld <-> Nether, 1:8) converted into
// current-dimension coordinates — the same rule as zonesFor. Converted
// polylines carry a flag so the UI can render them dashed; the End has no
// linked dimension.
/**
 * @typedef {{path: UserPath, pts: PathPoint[], converted: boolean}} DisplayPath
 */
/**
 * @param {UserPath[]} list
 * @param {{seed: string|number, mc: number, large: boolean, dim: number}} world
 * @returns {DisplayPath[]} display polylines, in current-dimension blocks
 */
export function pathsFor(list, world) {
  /** @type {DisplayPath[]} */
  const out = [];
  for (const p of list) {
    if (String(p.seed) !== String(world.seed) || p.mc !== world.mc || !!p.large !== !!world.large) continue;
    if (p.dim === world.dim) {
      out.push({ path: p, pts: p.pts, converted: false });
      continue;
    }
    const conv = p.pts.map((pt) => convertCoords(p.dim, pt.x, pt.z));
    // only the Overworld <-> Nether pair converts; conv[0] is null for the End
    if (!conv[0] || (p.dim === 0 ? -1 : 0) !== world.dim) continue;
    out.push({ path: p, pts: conv.map((c) => ({ x: c.x, z: c.z })), converted: true });
  }
  return out;
}

/** @param {any} p candidate entry @returns {UserPath|null} */
function normalizePath(p) {
  if (!p || typeof p !== 'object') return null;
  const id = Number(p.id), mc = Number(p.mc), dim = Number(p.dim);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(mc)) return null;
  if (![0, -1, 1].includes(dim)) return null;
  if (typeof p.seed !== 'string' && typeof p.seed !== 'number') return null;
  const name = String(p.name ?? '').trim().slice(0, PATH_NAME_MAX);
  if (!name) return null;
  const pts = normalizePoints(p.pts);
  if (pts.length < 2) return null;
  return { id, seed: String(p.seed), mc, large: !!p.large, dim, pts, name };
}

// localStorage and imported profiles are outside the app's control: only
// well-formed entries survive (first id wins)
/**
 * @param {string|null} json raw payload
 * @returns {UserPath[]} well-formed paths only
 */
export function parsePaths(json) {
  let raw;
  try { raw = JSON.parse(String(json)); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const byId = new Map();
  for (const p of raw.slice(0, PATH_MAX)) {
    const pn = normalizePath(p);
    if (pn && !byId.has(pn.id)) byId.set(pn.id, pn);
  }
  return [...byId.values()];
}

// import/merge: append the imported paths with fresh ids, skipping exact
// duplicates (same world + same waypoints), capped like every add — the
// same rules as the marker/zone merge
/**
 * @param {UserPath[]} list current paths
 * @param {UserPath[]} imported parsed import payload
 * @returns {UserPath[]} merged list (input untouched)
 */
export function mergePaths(list, imported) {
  let out = list;
  for (const p of imported) out = addPath(out, p);
  return out;
}
