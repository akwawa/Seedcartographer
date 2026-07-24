// tiledb.js — persistent tile cache between sessions (#289). Rendered biome
// tiles (RGBA buffers + placement metadata) are kept in IndexedDB so a
// previously explored seed paints instantly on the next visit, while the
// worker regenerates fresh pixels. Browser-only wrapper around IndexedDB:
// the key and eviction policy is pure logic in tilecache.js; everything
// here is best-effort (private mode, quota errors and blocked opens degrade
// to "no persistent cache", never to a broken app).

import { evictionPlan, TILE_DB_BUDGET } from './tilecache.js';

const DB_NAME = 'seedcartographer-tiles';
const TILES = 'tiles';   // key → {key, wk, rgba, cols, rows, scale, originX, originZ, present}
const META = 'meta';     // key → {key, size, lastUsed} (cheap LRU scan without the buffers)
const VERSION_LS_KEY = 'tileDbVersion';

/** @param {IDBRequest} r @returns {Promise<any>} */
function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
/** @param {IDBTransaction} tx @returns {Promise<void>} */
function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Open (or create) the tile store. When the deployed app/engine version
 * differs from the one the tiles were rendered with, the store is wiped:
 * a new engine may paint the same world differently.
 * @param {string} appVersion current build stamp (version.js)
 * @returns {Promise<IDBDatabase|null>} null when IndexedDB is unavailable
 */
export async function openTileDB(appVersion) {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore(TILES, { keyPath: 'key' });
      open.result.createObjectStore(META, { keyPath: 'key' });
    };
    const db = await req(open);
    let stored = null;
    try { stored = localStorage.getItem(VERSION_LS_KEY); } catch { /* ignore */ }
    if (stored !== appVersion) {
      await clearTiles(db);
      try { localStorage.setItem(VERSION_LS_KEY, appVersion); } catch { /* ignore */ }
    }
    return db;
  } catch {
    return null;
  }
}

/**
 * Read one tile record and touch its lastUsed for the LRU.
 * @param {IDBDatabase} db
 * @param {string} key persistTileKey output
 * @returns {Promise<object|null>}
 */
export async function loadTile(db, key) {
  try {
    const tx = db.transaction([TILES, META], 'readwrite');
    const rec = await req(tx.objectStore(TILES).get(key));
    if (rec) tx.objectStore(META).put({ key, size: rec.rgba.byteLength, lastUsed: Date.now() });
    await txDone(tx);
    return rec || null;
  } catch {
    return null;
  }
}

/**
 * Store one rendered tile (record cloned by IndexedDB). Best-effort: quota
 * or transaction errors just mean the tile is not persisted.
 * @param {IDBDatabase} db
 * @param {{key: string, rgba: ArrayBuffer}} rec tile record (persist key)
 * @returns {Promise<void>}
 */
export async function saveTile(db, rec) {
  try {
    const tx = db.transaction([TILES, META], 'readwrite');
    tx.objectStore(TILES).put(rec);
    tx.objectStore(META).put({ key: rec.key, size: rec.rgba.byteLength, lastUsed: Date.now() });
    await txDone(tx);
  } catch { /* best-effort cache */ }
}

/**
 * Enforce the storage budget: delete least-recently-used tiles until the
 * total stored size fits (evictionPlan, tilecache.js).
 * @param {IDBDatabase} db
 * @param {number} [budget] bytes
 * @returns {Promise<void>}
 */
export async function trimTileDB(db, budget = TILE_DB_BUDGET) {
  try {
    const metas = await req(db.transaction(META).objectStore(META).getAll());
    const doomed = evictionPlan(metas, budget);
    if (!doomed.length) return;
    const tx = db.transaction([TILES, META], 'readwrite');
    for (const key of doomed) {
      tx.objectStore(TILES).delete(key);
      tx.objectStore(META).delete(key);
    }
    await txDone(tx);
  } catch { /* best-effort cache */ }
}

/**
 * Empty the store (manual purge button, version invalidation).
 * @param {IDBDatabase} db
 * @returns {Promise<void>}
 */
export async function clearTiles(db) {
  try {
    const tx = db.transaction([TILES, META], 'readwrite');
    tx.objectStore(TILES).clear();
    tx.objectStore(META).clear();
    await txDone(tx);
  } catch { /* best-effort cache */ }
}
