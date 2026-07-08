// profile.js — one-file export/import of everything the browser stores
// locally: favorites, custom presets, search history and user markers. Pure
// serialization/merge logic, shared between app.js (script tag) and the Node
// test suite (require). Each list goes through its own module's defensive
// parser on import, so a profile file is no more trusted than localStorage.
'use strict';

// browser: the sibling modules are loaded first as script tags; Node: require
const profileGlobals = /** @type {any} */ (globalThis);
const profileDeps = {
  parseFavorites: profileGlobals.parseFavorites || require('./favorites.js').parseFavorites,
  addFavorite: profileGlobals.addFavorite || require('./favorites.js').addFavorite,
  parseUserPresets: profileGlobals.parseUserPresets || require('./userpresets.js').parseUserPresets,
  addUserPreset: profileGlobals.addUserPreset || require('./userpresets.js').addUserPreset,
  parseHistory: profileGlobals.parseHistory || require('./searchhistory.js').parseHistory,
  addHistoryEntry: profileGlobals.addHistoryEntry || require('./searchhistory.js').addHistoryEntry,
  parseMarkers: profileGlobals.parseMarkers || require('./usermarkers.js').parseMarkers,
  mergeMarkers: profileGlobals.mergeMarkers || require('./usermarkers.js').mergeMarkers
};

const PROFILE_KIND = 'seedcartographer-profile';
const PROFILE_VERSION = 1;

/**
 * @typedef {{favorites: object[],
 *            userPresets: Array<{id: number, name: string, dim: number, c: object}>,
 *            history: Array<{at: number}>,
 *            markers: object[]}} ProfileState
 */

// The export payload, ready to stringify: a kind marker guards against
// importing an arbitrary JSON file (e.g. a markers-only export).
/**
 * @param {ProfileState} state current local data
 * @returns {string} pretty JSON
 */
function exportProfile(state) {
  return JSON.stringify({
    kind: PROFILE_KIND, version: PROFILE_VERSION,
    favorites: state.favorites, userPresets: state.userPresets,
    history: state.history, markers: state.markers
  }, null, 2);
}

// Parse an imported profile defensively: each list is re-validated by its
// own module's parser (unknown fields dropped, malformed entries skipped).
// Returns null when the payload is not a profile export at all.
/**
 * @param {string|null} json raw file content
 * @returns {ProfileState|null}
 */
function parseProfile(json) {
  let raw;
  try { raw = JSON.parse(String(json)); } catch { return null; }
  if (!raw || typeof raw !== 'object' || raw.kind !== PROFILE_KIND) return null;
  const list = (/** @type {unknown} */ v) => JSON.stringify(Array.isArray(v) ? v : []);
  return {
    favorites: profileDeps.parseFavorites(list(raw.favorites)),
    userPresets: profileDeps.parseUserPresets(list(raw.userPresets)),
    history: profileDeps.parseHistory(list(raw.history)),
    markers: profileDeps.parseMarkers(list(raw.markers))
  };
}

// Merge an imported profile into the current state, reusing each module's
// own semantics: favorites/markers skip same-world-same-spot duplicates and
// get fresh ids, presets replace on same name, history entries interleave by
// recency without duplicates. Caps apply as on any normal add.
/**
 * @param {ProfileState} current local data
 * @param {ProfileState} imported parsed profile (parseProfile output)
 * @returns {ProfileState} merged state (inputs untouched)
 */
function mergeProfile(current, imported) {
  let favorites = current.favorites;
  for (const f of imported.favorites) favorites = profileDeps.addFavorite(favorites, f);
  let userPresets = current.userPresets;
  for (const p of imported.userPresets) userPresets = profileDeps.addUserPreset(userPresets, p.name, p.dim, p.c);
  // fold oldest-first so the newest entries end up on top of the history
  let history = current.history;
  for (const e of [...imported.history].sort((a, b) => a.at - b.at)) {
    history = profileDeps.addHistoryEntry(history, e);
  }
  return { favorites, userPresets, history, markers: profileDeps.mergeMarkers(current.markers, imported.markers) };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PROFILE_KIND, PROFILE_VERSION, exportProfile, parseProfile, mergeProfile };
}
