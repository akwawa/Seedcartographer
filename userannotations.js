// userannotations.js — free text notes placed anywhere on the map ("mine
// entrance", "beware of the ravine"), independent of search results. Pure
// list operations shared between app.js (backed by localStorage) and the
// Node test suite. No data ever leaves the browser except through the
// explicit profile export / sync code.
import { convertCoords } from './coords.js';

export const ANNOTATION_MAX = 100;        // sanity cap so localStorage cannot grow unbounded
export const ANNOTATION_TEXT_MAX = 60;    // display cap for the free text
export const ANNOTATION_COORD_LIMIT = 29999984;   // Java world border

// an annotation is bound to the exact world it was written in, like a marker
/**
 * @typedef {{id: number, seed: string, mc: number, large: boolean, dim: number,
 *            x: number, z: number, text: string}} UserAnnotation
 */

/** @param {UserAnnotation[]} list @returns {number} smallest unused positive id */
function nextAnnotationId(list) {
  return list.reduce((m, a) => Math.max(m, a.id), 0) + 1;
}

/** @param {number} v @returns {number} rounded coordinate inside the world border */
function clampCoord(v) {
  return Math.min(ANNOTATION_COORD_LIMIT, Math.max(-ANNOTATION_COORD_LIMIT, Math.round(v)));
}

/**
 * @param {{seed: string|number, mc: number, large: boolean, dim: number}} a
 * @param {{seed: string|number, mc: number, large: boolean, dim: number}} b
 * @returns {boolean}
 */
function sameAnnotationWorld(a, b) {
  return String(a.seed) === String(b.seed) && a.mc === b.mc && !!a.large === !!b.large && a.dim === b.dim;
}

// returns a new list; refuses duplicates (same world + same spot) and
// silently drops the add beyond the cap — the same rules as the markers
/**
 * @param {UserAnnotation[]} list current annotations
 * @param {{seed: string|number, mc: number, large: boolean, dim: number,
 *          x: number, z: number, text?: string}} a annotation to place
 * @returns {UserAnnotation[]} new list (input untouched)
 */
export function addAnnotation(list, a) {
  if (list.length >= ANNOTATION_MAX) return list;
  const x = clampCoord(a.x), z = clampCoord(a.z);
  if (list.some((e) => sameAnnotationWorld(e, a) && e.x === x && e.z === z)) return list;
  const text = String(a.text ?? '').trim().slice(0, ANNOTATION_TEXT_MAX) || `#${nextAnnotationId(list)}`;
  return [...list, {
    id: nextAnnotationId(list), seed: String(a.seed), mc: a.mc, large: !!a.large,
    dim: a.dim, x, z, text
  }];
}

/** @param {UserAnnotation[]} list @param {number} id @returns {UserAnnotation[]} */
export function removeAnnotation(list, id) {
  return list.filter((a) => a.id !== id);
}

// empty edits are ignored, like marker/zone renames
/** @param {UserAnnotation[]} list @param {number} id @param {string} text @returns {UserAnnotation[]} */
export function editAnnotation(list, id, text) {
  const s = String(text ?? '').trim().slice(0, ANNOTATION_TEXT_MAX);
  return list.map((a) => (a.id === id && s ? { ...a, text: s } : a));
}

// Annotations to display in `world`: those written in this exact world, plus
// the annotations of the linked dimension (Overworld <-> Nether, 1:8)
// converted into current-dimension coordinates — like zones and paths.
// Converted points carry a flag so the UI can render them differently; the
// End has no linked dimension.
/**
 * @typedef {{ann: UserAnnotation, x: number, z: number, converted: boolean}} DisplayAnnotation
 */
/**
 * @param {UserAnnotation[]} list
 * @param {{seed: string|number, mc: number, large: boolean, dim: number}} world
 * @returns {DisplayAnnotation[]} display points, in current-dimension blocks
 */
export function annotationsFor(list, world) {
  /** @type {DisplayAnnotation[]} */
  const out = [];
  for (const a of list) {
    if (String(a.seed) !== String(world.seed) || a.mc !== world.mc || !!a.large !== !!world.large) continue;
    if (a.dim === world.dim) {
      out.push({ ann: a, x: a.x, z: a.z, converted: false });
      continue;
    }
    const c = convertCoords(a.dim, a.x, a.z);
    // only the Overworld <-> Nether pair converts; c is null for the End
    if (!c || (a.dim === 0 ? -1 : 0) !== world.dim) continue;
    out.push({ ann: a, x: c.x, z: c.z, converted: true });
  }
  return out;
}

/** @param {any} a candidate entry @returns {UserAnnotation|null} */
function normalizeAnnotation(a) {
  if (!a || typeof a !== 'object') return null;
  const id = Number(a.id), mc = Number(a.mc), dim = Number(a.dim), x = Number(a.x), z = Number(a.z);
  const text = String(a.text ?? '').trim().slice(0, ANNOTATION_TEXT_MAX);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(mc)) return null;
  if (![0, -1, 1].includes(dim) || !Number.isFinite(x) || !Number.isFinite(z) || !text) return null;
  if (typeof a.seed !== 'string' && typeof a.seed !== 'number') return null;
  return { id, seed: String(a.seed), mc, large: !!a.large, dim, x: clampCoord(x), z: clampCoord(z), text };
}

// localStorage and imported profiles are outside the app's control: only
// well-formed entries survive (first id wins)
/**
 * @param {string|null} json raw payload
 * @returns {UserAnnotation[]} well-formed annotations only
 */
export function parseAnnotations(json) {
  let raw;
  try { raw = JSON.parse(String(json)); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const byId = new Map();
  for (const a of raw.slice(0, ANNOTATION_MAX)) {
    const an = normalizeAnnotation(a);
    if (an && !byId.has(an.id)) byId.set(an.id, an);
  }
  return [...byId.values()];
}

// import/merge: append the imported annotations with fresh ids, skipping
// exact duplicates (same world + same spot), capped like every add — the
// same rules as the marker merge
/**
 * @param {UserAnnotation[]} list current annotations
 * @param {UserAnnotation[]} imported parsed import payload
 * @returns {UserAnnotation[]} merged list (input untouched)
 */
export function mergeAnnotations(list, imported) {
  let out = list;
  for (const a of imported) out = addAnnotation(out, a);
  return out;
}
