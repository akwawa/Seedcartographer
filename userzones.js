// userzones.js — named rectangular zone annotations drawn on the map
// ("base here", "farm there"), independent of search results. Pure list
// operations shared between app.js (backed by localStorage) and the Node
// test suite. No data ever leaves the browser except through the explicit
// profile export / sync code.
import { convertCoords } from './coords.js';

export const ZONE_MAX = 100;         // sanity cap so localStorage cannot grow unbounded
export const ZONE_NAME_MAX = 60;     // display cap for free-text names
export const ZONE_COORD_LIMIT = 29999984;   // Java world border

// small fixed palette: the color picker offers exactly these values
export const ZONE_COLORS = [
  '#e07a7a', '#f2a73b', '#d8d05a', '#9ad06a',
  '#7ee0c0', '#7aa8e0', '#c89bf0', '#e08ad0'
];

// a zone is bound to the exact world it was drawn in, like a marker
/**
 * @typedef {{id: number, seed: string, mc: number, large: boolean, dim: number,
 *            x0: number, z0: number, x1: number, z1: number,
 *            name: string, color: string}} UserZone
 */

/** @param {UserZone[]} list @returns {number} smallest unused positive id */
function nextZoneId(list) {
  return list.reduce((m, z) => Math.max(m, z.id), 0) + 1;
}

/** @param {number} v @returns {number} rounded coordinate inside the world border */
function clampCoord(v) {
  return Math.min(ZONE_COORD_LIMIT, Math.max(-ZONE_COORD_LIMIT, Math.round(v)));
}

// ordered, clamped corners of a candidate rectangle
/**
 * @param {number} ax @param {number} az @param {number} bx @param {number} bz
 * @returns {{x0: number, z0: number, x1: number, z1: number}}
 */
function orderedRect(ax, az, bx, bz) {
  const a = { x: clampCoord(ax), z: clampCoord(az) }, b = { x: clampCoord(bx), z: clampCoord(bz) };
  return {
    x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z),
    x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z)
  };
}

/**
 * @param {{seed: string|number, mc: number, large: boolean, dim: number}} a
 * @param {{seed: string|number, mc: number, large: boolean, dim: number}} b
 * @returns {boolean}
 */
function sameZoneWorld(a, b) {
  return String(a.seed) === String(b.seed) && a.mc === b.mc && !!a.large === !!b.large && a.dim === b.dim;
}

/**
 * @param {{x0: number, z0: number, x1: number, z1: number}} a
 * @param {{x0: number, z0: number, x1: number, z1: number}} b
 * @returns {boolean}
 */
function sameRect(a, b) {
  return a.x0 === b.x0 && a.z0 === b.z0 && a.x1 === b.x1 && a.z1 === b.z1;
}

/** @param {any} color candidate value @returns {string} a palette color */
function zoneColor(color) {
  return ZONE_COLORS.includes(color) ? color : ZONE_COLORS[0];
}

// returns a new list; refuses degenerate rectangles (a line or a point) and
// duplicates (same world + same rectangle), silently drops the add beyond
// the cap
/**
 * @param {UserZone[]} list current zones
 * @param {{seed: string|number, mc: number, large: boolean, dim: number,
 *          x0: number, z0: number, x1: number, z1: number,
 *          name?: string, color?: string}} z zone to create
 * @returns {UserZone[]} new list (input untouched)
 */
export function addZone(list, z) {
  if (list.length >= ZONE_MAX) return list;
  const r = orderedRect(z.x0, z.z0, z.x1, z.z1);
  if (r.x0 === r.x1 || r.z0 === r.z1) return list;
  if (list.some((e) => sameZoneWorld(e, z) && sameRect(e, r))) return list;
  const name = String(z.name ?? '').trim().slice(0, ZONE_NAME_MAX) || `#${nextZoneId(list)}`;
  return [...list, {
    id: nextZoneId(list), seed: String(z.seed), mc: z.mc, large: !!z.large,
    dim: z.dim, ...r, name, color: zoneColor(z.color)
  }];
}

/** @param {UserZone[]} list @param {number} id @returns {UserZone[]} */
export function removeZone(list, id) {
  return list.filter((z) => z.id !== id);
}

/** @param {UserZone[]} list @param {number} id @param {string} name @returns {UserZone[]} */
export function renameZone(list, id, name) {
  const n = String(name ?? '').trim().slice(0, ZONE_NAME_MAX);
  return list.map((z) => (z.id === id && n ? { ...z, name: n } : z));
}

// only palette colors are accepted: anything else leaves the list unchanged
/** @param {UserZone[]} list @param {number} id @param {string} color @returns {UserZone[]} */
export function recolorZone(list, id, color) {
  if (!ZONE_COLORS.includes(color)) return list;
  return list.map((z) => (z.id === id ? { ...z, color } : z));
}

// Zones to display in `world`: those drawn in this exact world, plus the
// zones of the linked dimension (Overworld <-> Nether, 1:8) converted into
// current-dimension coordinates — like the coordinate conversion offered on
// markers. Converted rectangles carry a flag so the UI can render them
// differently; the End has no linked dimension.
/**
 * @typedef {{zone: UserZone, x0: number, z0: number, x1: number, z1: number,
 *            converted: boolean}} DisplayZone
 */
/**
 * @param {UserZone[]} list
 * @param {{seed: string|number, mc: number, large: boolean, dim: number}} world
 * @returns {DisplayZone[]} display rectangles, in current-dimension blocks
 */
export function zonesFor(list, world) {
  /** @type {DisplayZone[]} */
  const out = [];
  for (const z of list) {
    if (String(z.seed) !== String(world.seed) || z.mc !== world.mc || !!z.large !== !!world.large) continue;
    if (z.dim === world.dim) {
      out.push({ zone: z, x0: z.x0, z0: z.z0, x1: z.x1, z1: z.z1, converted: false });
      continue;
    }
    const a = convertCoords(z.dim, z.x0, z.z0), b = convertCoords(z.dim, z.x1, z.z1);
    // only the Overworld <-> Nether pair converts; a is null for the End
    if (!a || (z.dim === 0 ? -1 : 0) !== world.dim) continue;
    out.push({ zone: z, x0: a.x, z0: a.z, x1: b.x, z1: b.z, converted: true });
  }
  return out;
}

/** @param {any} z candidate entry @returns {UserZone|null} */
function normalizeZone(z) {
  if (!z || typeof z !== 'object') return null;
  const id = Number(z.id), mc = Number(z.mc), dim = Number(z.dim);
  const nums = [z.x0, z.z0, z.x1, z.z1].map(Number);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(mc)) return null;
  if (![0, -1, 1].includes(dim) || nums.some((v) => !Number.isFinite(v))) return null;
  if (typeof z.seed !== 'string' && typeof z.seed !== 'number') return null;
  const name = String(z.name ?? '').trim().slice(0, ZONE_NAME_MAX);
  if (!name) return null;
  const r = orderedRect(nums[0], nums[1], nums[2], nums[3]);
  if (r.x0 === r.x1 || r.z0 === r.z1) return null;
  return {
    id, seed: String(z.seed), mc, large: !!z.large, dim,
    ...r, name, color: zoneColor(z.color)
  };
}

// localStorage and imported profiles are outside the app's control: only
// well-formed entries survive (first id wins)
/**
 * @param {string|null} json raw payload
 * @returns {UserZone[]} well-formed zones only
 */
export function parseZones(json) {
  let raw;
  try { raw = JSON.parse(String(json)); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const byId = new Map();
  for (const z of raw.slice(0, ZONE_MAX)) {
    const zn = normalizeZone(z);
    if (zn && !byId.has(zn.id)) byId.set(zn.id, zn);
  }
  return [...byId.values()];
}

// import/merge: append the imported zones with fresh ids, skipping exact
// duplicates (same world + same rectangle), capped like every add — the
// same rules as the marker merge
/**
 * @param {UserZone[]} list current zones
 * @param {UserZone[]} imported parsed import payload
 * @returns {UserZone[]} merged list (input untouched)
 */
export function mergeZones(list, imported) {
  let out = list;
  for (const z of imported) out = addZone(out, z);
  return out;
}
