// tilecache.js — LRU cache of rendered map tiles, so panning and zooming
// redraw already-known areas instantly while fresh tiles are computed.
// Pure bookkeeping (no canvas API): shared between app.js (script tag) and
// the Node test suite (require).
'use strict';

const TILE_CACHE_MAX = 24;   // tiles kept; ~viewport-sized each, so a few MB

// World identity of a tile: any of these changing makes cached pixels stale.
/**
 * @param {{seed: string|number, mc: number, large: boolean, dim: number}} world
 * @param {number} y altitude layer used for the render
 * @returns {string}
 */
function tileWorldKey(world, y) {
  return `${world.seed}|${world.mc}|${world.large ? 1 : 0}|${world.dim}|${y}`;
}

/**
 * @param {string} worldKey from tileWorldKey
 * @param {number} scale blocks per tile cell
 * @param {number} originX tile NW corner (blocks)
 * @param {number} originZ tile NW corner (blocks)
 * @returns {string}
 */
function tileKey(worldKey, scale, originX, originZ) {
  return `${worldKey}|${scale}|${originX}|${originZ}`;
}

// Minimal LRU on Map insertion order: put/touch move to the back, overflow
// evicts the front (least recently used).
/**
 * @param {number} [max] cache capacity
 * @returns {{put: (entry: {key: string}) => void, touch: (key: string) => void,
 *            entries: () => object[], clear: () => void, size: () => number}}
 */
function createTileCache(max = TILE_CACHE_MAX) {
  const map = new Map();
  return {
    put(entry) {
      if (map.has(entry.key)) map.delete(entry.key);
      map.set(entry.key, entry);
      if (map.size > max) map.delete(map.keys().next().value);
    },
    touch(key) {
      const e = map.get(key);
      if (e) { map.delete(key); map.set(key, e); }
    },
    entries() { return [...map.values()]; },
    clear() { map.clear(); },
    size() { return map.size; }
  };
}

// Cached tiles of `worldKey` intersecting the world-block rect, ordered for
// painting: coarse scales first (fine tiles overpaint them), and within a
// scale least-recently-used first (fresher pixels overpaint staler ones).
/**
 * @param {Array<{worldKey: string, scale: number, originX: number,
 *                originZ: number, cols: number, rows: number}>} entries
 *        cache entries in LRU order (oldest first)
 * @param {string} worldKey current world identity
 * @param {{x0: number, z0: number, x1: number, z1: number}} rect view (blocks)
 * @returns {object[]} tiles to draw, in painting order
 */
function tilesInView(entries, worldKey, rect) {
  return entries
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.worldKey === worldKey
      && e.originX < rect.x1 && e.originX + e.cols * e.scale > rect.x0
      && e.originZ < rect.z1 && e.originZ + e.rows * e.scale > rect.z0)
    .sort((a, b) => (b.e.scale - a.e.scale) || (a.i - b.i))
    .map(({ e }) => e);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TILE_CACHE_MAX, tileWorldKey, tileKey, createTileCache, tilesInView };
}
