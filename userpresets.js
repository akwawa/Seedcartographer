// userpresets.js — user-saved search-criteria presets. Pure list operations,
// shared between app.js (script tag, backed by localStorage) and the Node
// test suite (require). No data ever leaves the browser.
//
// Unlike the built-in PRESETS (stable structure indexes, resolved at load),
// a user preset stores the criteria exactly as readCriteria() produced them
// (share-link `c` shape, engine enum structure types) plus the dimension the
// criteria belong to; replaying goes through the same sanitizeCriteria path
// as share links.

export const USER_PRESET_MAX = 30;      // sanity cap so localStorage cannot grow unbounded
export const USER_PRESET_NAME_MAX = 40; // display cap for free-text names

/**
 * @typedef {{id: number, name: string, dim: number, c: object}} UserPreset
 */

/** @param {UserPreset[]} list @returns {number} smallest unused positive id */
function nextUserPresetId(list) {
  return list.reduce((m, p) => Math.max(m, p.id), 0) + 1;
}

// returns a new list; saving under an existing name replaces that preset
// (same id, updated criteria), a new name appends. Empty names and lists at
// the cap are refused (input returned untouched).
/**
 * @param {UserPreset[]} list current presets
 * @param {string} name free-text name (trimmed, capped)
 * @param {number} dim dimension the criteria belong to
 * @param {object} crit criteria in the share-link `c` shape
 * @returns {UserPreset[]} new list (input untouched)
 */
export function addUserPreset(list, name, dim, crit) {
  const n = String(name ?? '').trim().slice(0, USER_PRESET_NAME_MAX);
  if (!n) return list;
  const existing = list.find((p) => p.name === n);
  if (existing) return list.map((p) => (p === existing ? { ...p, dim, c: crit } : p));
  if (list.length >= USER_PRESET_MAX) return list;
  return [...list, { id: nextUserPresetId(list), name: n, dim, c: crit }];
}

/**
 * @param {UserPreset[]} list
 * @param {number} id preset to remove
 * @returns {UserPreset[]} new list (input untouched)
 */
export function removeUserPreset(list, id) {
  return list.filter((p) => p.id !== id);
}

// localStorage contents are outside the app's control: only well-formed
// entries survive (first id wins; the criteria object itself is re-sanitized
// by applyCriteria on replay)
/**
 * @param {string|null} json raw localStorage payload
 * @returns {UserPreset[]} well-formed presets only
 */
export function parseUserPresets(json) {
  let raw;
  try { raw = JSON.parse(String(json)); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const byId = new Map();
  for (const p of raw.slice(0, USER_PRESET_MAX)) {
    if (!p || typeof p !== 'object' || typeof p.c !== 'object' || p.c === null) continue;
    const id = Number(p.id), dim = Number(p.dim);
    const name = String(p.name ?? '').trim().slice(0, USER_PRESET_NAME_MAX);
    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(dim) || !name) continue;
    if (!byId.has(id)) byId.set(id, { id, name, dim, c: p.c });
  }
  return [...byId.values()];
}
