// worker.js — owns a cubiomes WASM instance. Handles tile rendering,
// structure listing, biome probing and the combined location search.
importScripts('./mcfinder.js');
importScripts('./seed.js');
importScripts('./search.js');

let M = null;            // the WASM module
let colors = null;       // Uint8Array[256*3] biome colors
let ready = false;
const SCALE_Y = 15;      // ~y60 at 1:4 vertical scaling

// reusable scratch buffers (grown on demand)
let areaPtr = 0, areaCap = 0;
let listPtr = 0, listCap = 0;

createMcFinder().then((mod) => {
  M = mod;
  const cp = M._malloc(256 * 3);
  M._fillBiomeColors(cp);
  colors = M.HEAPU8.slice(cp, cp + 256 * 3);
  M._free(cp);
  ready = true;
  postMessage({ type: 'ready', mcNewest: M._c_mc_newest() });
}).catch((err) => {
  postMessage({ type: 'fatal', message: 'WASM module failed to load: ' + (err && err.message || err) });
});

function ensureArea(cells) {
  if (cells > areaCap) {
    if (areaPtr) M._free(areaPtr);
    areaPtr = M._malloc(cells * 4);
    areaCap = cells;
  }
}
function ensureList(pairs) {
  if (pairs > listCap) {
    if (listPtr) M._free(listPtr);
    listPtr = M._malloc(pairs * 2 * 4);
    listCap = pairs;
  }
}

let curSeedStr = null, curMc = null, curLarge = null;
function applyWorld(seedStr, mc, large) {
  if (seedStr === curSeedStr && mc === curMc && large === curLarge) return;
  M._initGen(mc, large ? 1 : 0, seedToBigInt(seedStr));
  curSeedStr = seedStr; curMc = mc; curLarge = large;
}

// pick the smallest cubiomes scale >= bpp so the cell grid stays ~viewport-sized
function chooseScale(bpp) {
  const S = [4, 16, 64, 256];
  for (const s of S) if (s >= bpp) return s;
  return 256;
}

onmessage = (e) => {
  if (!ready) { /* messages before ready are re-sent by main */ return; }
  const d = e.data;

  if (d.type === 'render') {
    applyWorld(d.seed, d.mc, d.large);
    const scale = chooseScale(d.bpp);
    // world block bounds of the viewport
    const halfW = d.w * d.bpp / 2, halfH = d.h * d.bpp / 2;
    const x0b = d.cx - halfW, z0b = d.cz - halfH;
    // scaled NW corner (floor) and cell grid size
    const sx0 = Math.floor(x0b / scale), sz0 = Math.floor(z0b / scale);
    const cols = Math.ceil((d.w * d.bpp) / scale) + 1;
    const rows = Math.ceil((d.h * d.bpp) / scale) + 1;
    ensureArea(cols * rows);
    const ok = M._genBiomeArea(areaPtr, sx0, sz0, cols, rows, scale, SCALE_Y);
    const rgba = new Uint8ClampedArray(cols * rows * 4);
    if (ok) {
      const base = areaPtr >> 2;
      for (let i = 0; i < cols * rows; i++) {
        let id = M.HEAP32[base + i];
        if (id < 0 || id > 255) id = 0;
        const c = id * 3;
        rgba[i * 4] = colors[c];
        rgba[i * 4 + 1] = colors[c + 1];
        rgba[i * 4 + 2] = colors[c + 2];
        rgba[i * 4 + 3] = 255;
      }
    }
    postMessage({
      type: 'tile', reqId: d.reqId, ok: !!ok, rgba: rgba.buffer, cols, rows, scale,
      // world coords of the cell-grid NW corner, for placement on the map
      originX: sx0 * scale, originZ: sz0 * scale
    }, [rgba.buffer]);
    return;
  }

  if (d.type === 'structures') {
    applyWorld(d.seed, d.mc, d.large);
    const cap = 4000;
    ensureList(cap);
    const out = [];
    for (const st of d.types) {
      const n = M._listStructures(st, d.x0, d.z0, d.x1, d.z1, listPtr, cap);
      const base = listPtr >> 2;
      const pts = [];
      for (let i = 0; i < n; i++) pts.push([M.HEAP32[base + i * 2], M.HEAP32[base + i * 2 + 1]]);
      out.push({ type: st, points: pts });
    }
    postMessage({ type: 'structures', reqId: d.reqId, groups: out });
    return;
  }

  if (d.type === 'biome') {
    applyWorld(d.seed, d.mc, d.large);
    const id = M._biomeAtBlock(d.x, d.z, 60);
    postMessage({ type: 'biome', reqId: d.reqId, id, name: M.UTF8ToString(M._biomeName(id)) });
    return;
  }

  if (d.type === 'search') {
    applyWorld(d.seed, d.mc, d.large);
    const t0 = performance.now();
    const fail = (error) => postMessage({ type: 'search', reqId: d.reqId, error, hits: [], ms: Math.round(performance.now() - t0) });

    // biome grid over the search box padded by the largest adjacency distance
    const SC = 16;
    const adjClauses = (d.adjClauses || []).map((c) => ({ biomes: new Set(c.biomes), dist: c.dist, negate: !!c.negate }));
    const pad = adjClauses.reduce((m, c) => Math.max(m, c.dist), 0);
    const gx0 = Math.floor((d.cx - d.range - pad) / SC);
    const gz0 = Math.floor((d.cz - d.range - pad) / SC);
    const cols = Math.ceil((d.cx + d.range + pad) / SC) - gx0 + 2;
    const rows = Math.ceil((d.cz + d.range + pad) / SC) - gz0 + 2;
    if (cols * rows > SEARCH_MAX_CELLS) { fail('area-too-large'); return; }
    ensureArea(cols * rows);
    if (!M._genBiomeArea(areaPtr, gx0, gz0, cols, rows, SC, 15)) { fail('area-too-large'); return; }

    // structure positions per clause, over the box padded by that clause's radius
    const structClauses = (d.structClauses || []).map((c) => {
      const cap = 40000;
      ensureList(cap);
      const n = M._listStructures(c.type,
        d.cx - d.range - c.radius, d.cz - d.range - c.radius,
        d.cx + d.range + c.radius, d.cz + d.range + c.radius,
        listPtr, cap);
      const base = listPtr >> 2;
      const points = [];
      for (let i = 0; i < n; i++) points.push([M.HEAP32[base + i * 2], M.HEAP32[base + i * 2 + 1]]);
      return { points, min: c.min, radius: c.radius };
    });

    // take the grid view only after all allocations (memory growth detaches views)
    const grid = M.HEAP32.subarray(areaPtr >> 2, (areaPtr >> 2) + cols * rows);
    const hits = scanGrid({
      grid, cols, rows, gx0, gz0, SC,
      cx: d.cx, cz: d.cz, range: d.range, step: d.step, mergeDist: d.mergeDist,
      mainSet: new Set(d.mainBiomes),
      adjMode: d.adjMode, adjClauses,
      structMode: d.structMode, structClauses
    });
    if (!hits) { fail('bad-request'); return; }
    postMessage({ type: 'search', reqId: d.reqId, hits, ms: Math.round(performance.now() - t0) });
    return;
  }

  if (d.type === 'structConsts') {
    postMessage({ type: 'structConsts', values: d.indices.map((i) => M._structConst(i)) });
    return;
  }

  if (d.type === 'biomeList') {
    // enumerate valid biome ids + names + colors for the dropdowns
    const list = [];
    for (let id = 0; id <= 255; id++) {
      const name = M.UTF8ToString(M._biomeName(id));
      if (!name) continue;
      list.push({ id, name, rgb: [colors[id * 3], colors[id * 3 + 1], colors[id * 3 + 2]] });
    }
    postMessage({ type: 'biomeList', list });
    return;
  }
};
