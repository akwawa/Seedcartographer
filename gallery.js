// gallery.js — pure logic behind the seed gallery page: entry validation
// (gallery.json is editorial data, checked by test) and share-link building.
// Shared between gallery.html (script tag) and the Node test suite (require).
'use strict';

// browser: sharestate.js is loaded first; Node tests: require directly
const galleryGlobals = /** @type {any} */ (globalThis);
const galleryEncode = galleryGlobals.encodeShareState || require('./sharestate.js').encodeShareState;

const GALLERY_DIMS = new Set([0, -1, 1]);

/**
 * @typedef {{id: string, seed: string, mc: number, large: boolean,
 *            dim: number, x: number, z: number, b: number, y: number,
 *            title: Record<string, string>, desc: Record<string, string>,
 *            c?: object}} GalleryEntry
 */

// One editorial entry, normalized — or null when malformed. `title.en` and
// `desc.en` are mandatory (the render falls back to English).
/** @param {any} e @returns {GalleryEntry|null} */
function validateGalleryEntry(e) {
  if (!e || typeof e !== 'object') return null;
  if (typeof e.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(e.id)) return null;
  if (typeof e.seed !== 'string' && typeof e.seed !== 'number') return null;
  const mc = Number(e.mc), dim = Number(e.dim), x = Number(e.x), z = Number(e.z);
  const b = Number(e.b), y = Number(e.y);
  if (![mc, dim, x, z, b, y].every(Number.isFinite)) return null;
  if (!GALLERY_DIMS.has(dim) || b <= 0) return null;
  const lang = (/** @type {any} */ v) => (v && typeof v === 'object' && typeof v.en === 'string' && v.en.trim() ? v : null);
  const title = lang(e.title), desc = lang(e.desc);
  if (!title || !desc) return null;
  if (e.c !== undefined && (typeof e.c !== 'object' || e.c === null)) return null;
  return {
    id: e.id, seed: String(e.seed), mc, large: !!e.large, dim,
    x: Math.round(x), z: Math.round(z), b, y: Math.round(y), title, desc,
    ...(e.c !== undefined ? { c: e.c } : {})
  };
}

// The whole gallery file: only well-formed entries with unique ids survive.
/** @param {any} raw parsed gallery.json content @returns {GalleryEntry[]} */
function validateGallery(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const e of raw) {
    const entry = validateGalleryEntry(e);
    if (entry && !seen.has(entry.id)) { seen.add(entry.id); out.push(entry); }
  }
  return out;
}

// Share-link hash opening the app on the entry (legacy uncompressed format:
// readable by every app version, and the gallery page stays synchronous).
/** @param {GalleryEntry} e @returns {string} hash payload (without '#') */
function galleryEntryHash(e) {
  const state = {
    s: e.seed, m: e.mc, l: e.large ? 1 : 0, d: e.dim, y: e.y,
    x: e.x, z: e.z, b: e.b, ...(e.c ? { c: e.c } : {})
  };
  return galleryEncode(state);
}

// Localized field with an English fallback.
/** @param {Record<string, string>} field @param {string} lang @returns {string} */
function galleryText(field, lang) {
  return typeof field[lang] === 'string' && field[lang].trim() ? field[lang] : field.en;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateGalleryEntry, validateGallery, galleryEntryHash, galleryText };
}
