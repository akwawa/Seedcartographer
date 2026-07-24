// profile.js — one-file export/import of everything the browser stores
// locally: favorites, custom presets, search history and user markers. Pure
// serialization/merge logic, shared between app.js and the Node test suite
// (ES module imports). Each list goes through its own module's defensive
// parser on import, so a profile file is no more trusted than localStorage.

import { parseFavorites, addFavorite } from './favorites.js';
import { parseUserPresets, addUserPreset } from './userpresets.js';
import { parseHistory, addHistoryEntry } from './searchhistory.js';
import { parseMarkers, mergeMarkers } from './usermarkers.js';
import { parseZones, mergeZones } from './userzones.js';
import { parsePaths, mergePaths } from './userpaths.js';

export const PROFILE_KIND = 'seedcartographer-profile';
export const PROFILE_VERSION = 1;

/**
 * @typedef {{favorites: import('./favorites.js').Favorite[],
 *            userPresets: Array<{id: number, name: string, dim: number, c: object}>,
 *            history: import('./searchhistory.js').HistoryEntry[],
 *            markers: import('./usermarkers.js').UserMarker[],
 *            zones: import('./userzones.js').UserZone[],
 *            paths: import('./userpaths.js').UserPath[]}} ProfileState
 */

// The export payload, ready to stringify: a kind marker guards against
// importing an arbitrary JSON file (e.g. a markers-only export).
/**
 * @param {ProfileState} state current local data
 * @returns {string} pretty JSON
 */
export function exportProfile(state) {
  return JSON.stringify({
    kind: PROFILE_KIND, version: PROFILE_VERSION,
    favorites: state.favorites, userPresets: state.userPresets,
    history: state.history, markers: state.markers, zones: state.zones,
    paths: state.paths
  }, null, 2);
}

// Parse an imported profile defensively: each list is re-validated by its
// own module's parser (unknown fields dropped, malformed entries skipped).
// Returns null when the payload is not a profile export at all.
/**
 * @param {string|null} json raw file content
 * @returns {ProfileState|null}
 */
export function parseProfile(json) {
  let raw;
  try { raw = JSON.parse(String(json)); } catch { return null; }
  if (!raw || typeof raw !== 'object' || raw.kind !== PROFILE_KIND) return null;
  const list = (/** @type {unknown} */ v) => JSON.stringify(Array.isArray(v) ? v : []);
  return {
    favorites: parseFavorites(list(raw.favorites)),
    userPresets: parseUserPresets(list(raw.userPresets)),
    history: parseHistory(list(raw.history)),
    markers: parseMarkers(list(raw.markers)),
    zones: parseZones(list(raw.zones)),
    paths: parsePaths(list(raw.paths))
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
export function mergeProfile(current, imported) {
  let favorites = current.favorites;
  for (const f of imported.favorites) favorites = addFavorite(favorites, f);
  let userPresets = current.userPresets;
  for (const p of imported.userPresets) userPresets = addUserPreset(userPresets, p.name, p.dim, p.c);
  // fold oldest-first so the newest entries end up on top of the history
  let history = current.history;
  for (const e of [...imported.history].sort((a, b) => a.at - b.at)) {
    history = addHistoryEntry(history, e);
  }
  return {
    favorites, userPresets, history,
    markers: mergeMarkers(current.markers, imported.markers),
    zones: mergeZones(current.zones, imported.zones),
    paths: mergePaths(current.paths, imported.paths)
  };
}
