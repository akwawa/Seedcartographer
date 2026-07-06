// favorites.js — pinned places with free-text notes. Pure list operations,
// shared between app.js (script tag, backed by localStorage) and the Node
// test suite (require). No data ever leaves the browser.
'use strict';

const FAV_MAX = 200;   // sanity cap so localStorage cannot grow unbounded

// a favorite is bound to the exact world it was found in
function favWorld(f) {
  return { seed: String(f.seed), mc: f.mc, large: !!f.large, dim: f.dim };
}
function sameWorld(a, b) {
  return String(a.seed) === String(b.seed) && a.mc === b.mc && !!a.large === !!b.large && a.dim === b.dim;
}

function nextFavId(list) {
  return list.reduce((m, f) => Math.max(m, f.id), 0) + 1;
}

// returns a new list; refuses duplicates (same world + same spot) and
// silently drops the add beyond the cap
function addFavorite(list, fav) {
  if (list.length >= FAV_MAX) return list;
  if (findFavorite(list, fav, fav) !== undefined) return list;
  return [...list, { ...fav, note: fav.note || '', id: nextFavId(list) }];
}

function findFavorite(list, world, spot) {
  return list.find((f) => sameWorld(f, world) && f.x === spot.x && f.z === spot.z);
}

function removeFavorite(list, id) {
  return list.filter((f) => f.id !== id);
}

function updateFavoriteNote(list, id, note) {
  return list.map((f) => (f.id === id ? { ...f, note: String(note) } : f));
}

function favoritesFor(list, world) {
  return list.filter((f) => sameWorld(f, world));
}

// normalize one stored entry; null when it is not a well-formed favorite
function normalizeFavorite(f) {
  if (!f || typeof f !== 'object') return null;
  const { id, seed, mc, large, dim, x, z, note } = f;
  if (!Number.isInteger(id) || !Number.isInteger(mc) || !Number.isInteger(x) || !Number.isInteger(z)) return null;
  if (![0, -1, 1].includes(dim)) return null;
  if (typeof seed !== 'string' && typeof seed !== 'number') return null;
  return { id, seed: String(seed), mc, large: !!large, dim, x, z, note: typeof note === 'string' ? note : '' };
}

// Parse a stored JSON payload defensively: localStorage contents are outside
// the app's control, so only well-formed entries survive (first id wins).
function parseFavorites(json) {
  let raw;
  try { raw = JSON.parse(json); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const byId = new Map();
  for (const f of raw.slice(0, FAV_MAX)) {
    const fav = normalizeFavorite(f);
    if (fav && !byId.has(fav.id)) byId.set(fav.id, fav);
  }
  return [...byId.values()];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FAV_MAX, favWorld, addFavorite, findFavorite, removeFavorite,
    updateFavoriteNote, favoritesFor, parseFavorites
  };
}
