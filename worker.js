// worker.js — owns a cubiomes WASM instance. Handles tile rendering,
// structure listing, biome probing and the combined location search.
importScripts('./mcfinder.js', './seed.js', './search.js', './slime.js', './markers.js', './palette.js', './tilegrid.js', './relief.js');

let M = null;            // the WASM module
let colors = null;       // Uint8Array[256*3] biome colors (active table)
let baseColors = null;   // default engine colors
let altColors = null;    // high-visibility table, built lazily
let ready = false;
const DEFAULT_Y = 60;    // surface-ish default altitude
// biomes are sampled at 1:4 vertically: block y -> scaled y
function scaledY(y) { return Math.floor((Number.isInteger(y) ? y : DEFAULT_Y) / 4); }

// reusable scratch buffers (grown on demand)
let areaPtr = 0, areaCap = 0;
let listPtr = 0, listCap = 0;
// the search grid lives in its own buffer: tile renders may interleave with
// the sliced search job and reuse areaPtr, which would clobber the grid
let searchPtr = 0, searchCap = 0;

createMcFinder().then((mod) => {
  M = mod;
  const cp = M._malloc(256 * 3);
  M._fillBiomeColors(cp);
  baseColors = M.HEAPU8.slice(cp, cp + 256 * 3);
  colors = baseColors;
  M._free(cp);
  ready = true;
  postMessage({ type: 'ready', mcNewest: M._c_mc_newest() });
}).catch((err) => {
  postMessage({ type: 'fatal', message: 'WASM module failed to load: ' + (err?.message || err) });
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
function ensureSearchArea(cells) {
  if (cells > searchCap) {
    if (searchPtr) M._free(searchPtr);
    searchPtr = M._malloc(cells * 4);
    searchCap = cells;
  }
}

let curSeedStr = null, curMc = null, curLarge = null, curDim = null;
function applyWorld(seedStr, mc, large, dim = 0) {
  if (seedStr === curSeedStr && mc === curMc && large === curLarge && dim === curDim) return;
  M._initGen(mc, large ? 1 : 0, seedToBigInt(seedStr), dim);
  curSeedStr = seedStr; curMc = mc; curLarge = large; curDim = dim;
}

// slime chunks are pure JS (slime.js), Overworld-only. The layer goes empty on
// oversized boxes (zoomed way out, chunks would be sub-pixel anyway); the
// search clause caps its point list like the structure lister does.
const SLIME_LAYER_MAX_CHUNKS = 120000;
const SLIME_SEARCH_MAX_POINTS = 40000;
function slimeLayerPoints(d) {
  if ((d.dim || 0) !== 0) return [];
  const chunksInBox = ((Math.floor(d.x1 / 16) - Math.floor(d.x0 / 16) + 1)
                     * (Math.floor(d.z1 / 16) - Math.floor(d.z0 / 16) + 1));
  if (chunksInBox > SLIME_LAYER_MAX_CHUNKS) return [];
  return slimeChunksInBox(seedToBigInt(d.seed), d.x0, d.z0, d.x1, d.z1, SLIME_LAYER_MAX_CHUNKS)
    .map(([cx, cz]) => [cx * 16, cz * 16]);   // NW block corner of each chunk
}

// Spawn and strongholds are Overworld-only, world-wide (not box-bound) and
// expensive to compute (biome checks), so they are cached per world.
const STRONGHOLD_MAX = 200;
let markerCache = { key: null, spawn: null, strongholds: null };
function markerKey() { return `${curSeedStr}|${curMc}|${curLarge}`; }
function spawnPoints(dim) {
  if ((dim || 0) !== 0) return [];
  if (markerCache.key !== markerKey()) markerCache = { key: markerKey(), spawn: null, strongholds: null };
  if (!markerCache.spawn) {
    ensureList(1);
    M._getSpawnPos(listPtr);
    const b = listPtr >> 2;
    markerCache.spawn = [[M.HEAP32[b], M.HEAP32[b + 1]]];
  }
  return markerCache.spawn;
}
function strongholdPoints(dim) {
  if ((dim || 0) !== 0) return [];
  if (markerCache.key !== markerKey()) markerCache = { key: markerKey(), spawn: null, strongholds: null };
  if (!markerCache.strongholds) {
    ensureList(STRONGHOLD_MAX);
    const n = M._listStrongholds(listPtr, STRONGHOLD_MAX);
    const b = listPtr >> 2;
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([M.HEAP32[b + i * 2], M.HEAP32[b + i * 2 + 1]]);
    markerCache.strongholds = pts;
  }
  return markerCache.strongholds;
}
// points for the synthetic marker types, or null for real structure enums
function syntheticPoints(type, dim) {
  if (type === SPAWN_STRUCT_TYPE) return spawnPoints(dim);
  if (type === STRONGHOLD_STRUCT_TYPE) return strongholdPoints(dim);
  return null;
}
// quad witch hut AFK spots inside a block box (Overworld only)
function quadHutPoints(dim, x0, z0, x1, z1) {
  if ((dim || 0) !== 0) return [];
  const cap = 500;
  ensureList(cap);
  const n = M._listQuadHuts(x0, z0, x1, z1, listPtr, cap);
  const base = listPtr >> 2;
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([M.HEAP32[base + i * 2], M.HEAP32[base + i * 2 + 1]]);
  return pts;
}
// structure points of any type (real, slime, spawn/stronghold, quad) in a box
function pointsOfType(type, dim, x0, z0, x1, z1, cap) {
  if (type === QUADHUT_STRUCT_TYPE) return quadHutPoints(dim, x0, z0, x1, z1);
  const synth = syntheticPoints(type, dim);
  if (synth) return synth;
  ensureList(cap);
  const n = M._listStructures(type, x0, z0, x1, z1, listPtr, cap);
  const base = listPtr >> 2;
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([M.HEAP32[base + i * 2], M.HEAP32[base + i * 2 + 1]]);
  return pts;
}

// pick the smallest cubiomes scale >= bpp so the cell grid stays ~viewport-sized
function chooseScale(bpp) {
  const S = [4, 16, 64, 256];
  for (const s of S) if (s >= bpp) return s;
  return 256;
}

// Resolve the search request's structure and pair clauses into point lists.
// Pair clauses ("a T1 and a T2 within `gap` blocks of each other") become
// midpoint pseudo-structures fed to the same per-cell radius machinery.
function buildStructClauses(d) {
  const clauses = (d.structClauses || []).map((c) => {
    if (c.type === SLIME_STRUCT_TYPE) {
      // chunk centers, so distances behave like structure positions
      const points = (d.dim || 0) === 0
        ? slimeChunksInBox(seedToBigInt(d.seed),
            d.cx - d.range - c.radius, d.cz - d.range - c.radius,
            d.cx + d.range + c.radius, d.cz + d.range + c.radius,
            SLIME_SEARCH_MAX_POINTS).map(([sx, sz]) => [sx * 16 + 8, sz * 16 + 8])
        : [];
      return { points, min: c.min, radius: c.radius };
    }
    const points = pointsOfType(c.type, d.dim,
      d.cx - d.range - c.radius, d.cz - d.range - c.radius,
      d.cx + d.range + c.radius, d.cz + d.range + c.radius, 40000);
    return { points, min: c.min, radius: c.radius, inMain: !!c.inMain };
  });
  for (const c of d.pairClauses || []) {
    const x0 = d.cx - d.range - c.radius - c.gap, z0 = d.cz - d.range - c.radius - c.gap;
    const x1 = d.cx + d.range + c.radius + c.gap, z1 = d.cz + d.range + c.radius + c.gap;
    const a = pointsOfType(c.t1, d.dim, x0, z0, x1, z1, 40000);
    const b = c.t2 === c.t1 ? a : pointsOfType(c.t2, d.dim, x0, z0, x1, z1, 40000);
    clauses.push({ points: pairMidpoints(a, b, c.gap), min: 1, radius: c.radius });
  }
  return clauses;
}

// distinct extra altitudes requested by adjacency clauses (block Y values)
function adjLayerYs(d) {
  const ys = new Set();
  for (const c of d.adjClauses || []) {
    if (Number.isInteger(c.y)) ys.add(c.y);
  }
  return [...ys];
}

// Generate one banded, cancellable biome grid per requested altitude into
// the search buffer, after the main grid. Returns true, or the failure kind.
async function genExtraLayers(layerYs, ctx) {
  const { cols, rows, gx0, gz0, SC } = ctx;
  const GEN_BAND = 512;
  for (let li = 0; li < layerYs.length; li++) {
    const base = searchPtr + (li + 1) * cols * rows * 4;
    for (let j = 0; j < rows; j += GEN_BAND) {
      if (ctx.cancelled()) return 'cancelled';
      const h = Math.min(GEN_BAND, rows - j);
      if (!M._genBiomeArea(base + j * cols * 4, gx0, gz0 + j, cols, h, SC, scaledY(layerYs[li]))) {
        return 'area-too-large';
      }
      await yieldToQueue();
    }
    ctx.progress(80 + Math.round(5 * (li + 1) / layerYs.length));
  }
  return true;
}

// ---- sliced, cancellable search ----
let searchBusy = false;
let searchCancelId = 0;
const yieldToQueue = () => new Promise((r) => setTimeout(r, 0));

async function runSearchJob(d) {
  searchBusy = true;
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  const fail = (error) => postMessage({ type: 'search', reqId: d.reqId, error, hits: [], ms: ms() });
  const progress = (pct) => postMessage({ type: 'searchProgress', reqId: d.reqId, pct });
  const cancelled = () => searchCancelId === d.reqId;
  try {
    applyWorld(d.seed, d.mc, d.large, d.dim);

    // biome grid over the search box padded by the largest adjacency distance
    const SC = 16;
    const adjClauses = (d.adjClauses || []).map((c) => ({ biomes: new Set(c.biomes), dist: c.dist, negate: !!c.negate }));
    const pctClauses = (d.pctClauses || []).map((c) => ({ biomes: new Set(c.biomes), dist: c.dist, pct: c.pct }));
    const pad = [...adjClauses, ...pctClauses].reduce((m, c) => Math.max(m, c.dist), 0);
    const gx0 = Math.floor((d.cx - d.range - pad) / SC);
    const gz0 = Math.floor((d.cz - d.range - pad) / SC);
    const cols = Math.ceil((d.cx + d.range + pad) / SC) - gx0 + 2;
    const rows = Math.ceil((d.cz + d.range + pad) / SC) - gz0 + 2;
    const layerYs = adjLayerYs(d);
    if (cols * rows * (1 + layerYs.length) > SEARCH_MAX_CELLS) { fail('area-too-large'); return; }
    ensureSearchArea(cols * rows * (1 + layerYs.length));

    // 1) generate the grid in row bands (0 → 80%), yielding between bands so
    // tile renders and cancel messages are processed
    const GEN_BAND = 512;
    for (let j = 0; j < rows; j += GEN_BAND) {
      if (cancelled()) { fail('cancelled'); return; }
      const h = Math.min(GEN_BAND, rows - j);
      if (!M._genBiomeArea(searchPtr + j * cols * 4, gx0, gz0 + j, cols, h, SC, scaledY(d.y))) {
        fail('area-too-large'); return;
      }
      progress(Math.round(80 * (j + h) / rows));
      await yieldToQueue();
    }

    // 1b) extra biome layers for the multi-Y adjacency clauses, same box
    const cells = cols * rows;
    const layersOk = await genExtraLayers(layerYs, { cols, rows, gx0, gz0, SC, cancelled, progress });
    if (layersOk !== true) { fail(layersOk); return; }

    // 2) structure positions per clause (fast)
    const structClauses = buildStructClauses(d);
    progress(85);
    await yieldToQueue();

    // 3) scan in row slices (85 → 100%), accumulating hits across slices
    const SCAN_BAND = 4096;
    const params = {
      cols, rows, gx0, gz0, SC,
      cx: d.cx, cz: d.cz, range: d.range, step: d.step, mergeDist: d.mergeDist,
      mainSet: new Set(d.mainBiomes),
      adjMode: d.adjMode, adjClauses,
      pctMode: d.pctMode, pctClauses,
      structMode: d.structMode, structClauses,
      // surface height is Overworld-only; heightAt calls into the engine
      surface: (d.dim || 0) === 0 && d.surface && (Number.isInteger(d.surface.min) || Number.isInteger(d.surface.max))
        ? { min: d.surface.min, max: d.surface.max, heightAt: (x, z) => M._approxSurfaceY(x, z) }
        : null,
      hits: []
    };
    for (let j = 0; j < rows; j += SCAN_BAND) {
      if (cancelled()) { fail('cancelled'); return; }
      // re-take the heap views each slice: interleaved allocations may grow memory
      params.grid = M.HEAP32.subarray(searchPtr >> 2, (searchPtr >> 2) + cols * rows);
      params.layers = layerYs.map((y, li) => {
        const b = (searchPtr >> 2) + (li + 1) * cells;
        return { y, grid: M.HEAP32.subarray(b, b + cells) };
      });
      params.rowStart = j; params.rowEnd = Math.min(j + SCAN_BAND, rows) - 1;
      const res = scanGrid(params);
      if (!res) { fail('bad-request'); return; }
      params.hits = res;
      progress(Math.min(100, 85 + Math.round(15 * (params.rowEnd + 1) / rows)));
      await yieldToQueue();
    }
    // the world spawn rides along so the app can offer distance-to-spawn
    // sorting without a second round-trip (Overworld only, cached per world)
    const spawn = (d.dim || 0) === 0 ? spawnPoints(0)[0] : null;
    postMessage({
      type: 'search', reqId: d.reqId, hits: params.hits, ms: ms(),
      spawn: spawn ? { x: spawn[0], z: spawn[1] } : null
    });
  } finally {
    searchBusy = false;
  }
}

// ---- multi-seed search: test the criteria around the origin of many seeds ----
let seedCancelId = 0;

function seedScanParams(d, cols, rows, gx0, gz0, SC) {
  const cells = cols * rows;
  return {
    grid: M.HEAP32.subarray(searchPtr >> 2, (searchPtr >> 2) + cells),
    layers: adjLayerYs(d).map((y, li) => {
      const b = (searchPtr >> 2) + (li + 1) * cells;
      return { y, grid: M.HEAP32.subarray(b, b + cells) };
    }),
    cols, rows, gx0, gz0, SC,
    cx: 0, cz: 0, range: d.range, step: d.step, mergeDist: Math.max(256, d.step * 6),
    mainSet: new Set(d.mainBiomes),
    adjMode: d.adjMode,
    adjClauses: (d.adjClauses || []).map((c) => ({ biomes: new Set(c.biomes), dist: c.dist, negate: !!c.negate })),
    pctMode: d.pctMode,
    pctClauses: (d.pctClauses || []).map((c) => ({ biomes: new Set(c.biomes), dist: c.dist, pct: c.pct })),
    structMode: d.structMode,
    structClauses: buildStructClauses({ ...d, cx: 0, cz: 0 }),
    surface: (d.dim || 0) === 0 && d.surface && (Number.isInteger(d.surface.min) || Number.isInteger(d.surface.max))
      ? { min: d.surface.min, max: d.surface.max, heightAt: (x, z) => M._approxSurfaceY(x, z) }
      : null,
    hits: []
  };
}

async function runSeedSearchJob(d) {
  const cancelled = () => seedCancelId === d.reqId;
  const SC = 16;
  const pad = [...(d.adjClauses || []), ...(d.pctClauses || [])].reduce((m, c) => Math.max(m, c.dist), 0);
  const gx0 = Math.floor((-d.range - pad) / SC);
  const gz0 = gx0;
  const cols = Math.ceil((d.range + pad) / SC) - gx0 + 2;
  const layerYs = adjLayerYs(d);
  if (cols * cols * (1 + layerYs.length) > SEARCH_MAX_CELLS) {
    postMessage({ type: 'seedBatchDone', reqId: d.reqId, error: 'area-too-large' });
    return;
  }
  ensureSearchArea(cols * cols * (1 + layerYs.length));
  for (const seedStr of d.seeds) {
    if (cancelled()) break;
    applyWorld(seedStr, d.mc, d.large, d.dim);
    if (!genSeedGrids(d.y, layerYs, cols, gx0, gz0, SC)) {
      postMessage({ type: 'seedBatchDone', reqId: d.reqId, error: 'area-too-large' });
      return;
    }
    const hits = scanGrid(seedScanParams(d, cols, cols, gx0, gz0, SC));
    // the best hit is the one closest to the origin the scan centers on
    let best = null, bd = Infinity;
    for (const h of hits || []) {
      const dd = h.x * h.x + h.z * h.z;
      if (dd < bd) { bd = dd; best = h; }
    }
    postMessage({
      type: 'seedScanned', reqId: d.reqId, seed: seedStr,
      hit: best, count: hits ? hits.length : 0
    });
    // let cancel messages through between seeds
    await yieldToQueue();
  }
  postMessage({ type: 'seedBatchDone', reqId: d.reqId });
}

// main grid + one grid per extra altitude for a single probed seed
function genSeedGrids(y, layerYs, cols, gx0, gz0, SC) {
  if (!M._genBiomeArea(searchPtr, gx0, gz0, cols, cols, SC, scaledY(y))) return false;
  for (let li = 0; li < layerYs.length; li++) {
    if (!M._genBiomeArea(searchPtr + (li + 1) * cols * cols * 4,
      gx0, gz0, cols, cols, SC, scaledY(layerYs[li]))) return false;
  }
  return true;
}

// checkerboard render: one fixed world-aligned tile of the progressive grid.
// A generation bump cancels every queued tile of older batches (off-screen
// requests are simply skipped instead of computed).
let tileGen = 0;
function handleRenderTile(d) {
  if (d.gen < tileGen) {
    // cancelled batch: acknowledge without computing so the app can drop
    // the request from its in-flight bookkeeping
    postMessage({ type: 'gridTile', key: d.key, wk: d.wk, skipped: true });
    return;
  }
  applyWorld(d.seed, d.mc, d.large, d.dim);
  const cells = TILE_CELLS * TILE_CELLS;
  ensureArea(cells);
  const ok = M._genBiomeArea(areaPtr, d.originX / d.scale, d.originZ / d.scale,
    TILE_CELLS, TILE_CELLS, d.scale, scaledY(d.y));
  const rgba = new Uint8ClampedArray(cells * 4);
  const present = new Set();
  if (ok) {
    paintTile(rgba, present, cells, null);
    if (d.relief && (d.dim || 0) === 0) applyRelief(rgba, d);
  }
  postMessage({
    type: 'gridTile', key: d.key, wk: d.wk, ok: !!ok, rgba: rgba.buffer,
    cols: TILE_CELLS, rows: TILE_CELLS, scale: d.scale, present: [...present],
    originX: d.originX, originZ: d.originZ
  }, [rgba.buffer]);
}

// hillshade overlay (Overworld): sample the approximate surface height on a
// coarse grid over the tile (step adapted to the zoom, relief.js), turn it
// into shade multipliers and darken/brighten the biome pixels in place
function applyRelief(rgba, d) {
  const step = reliefSampleStep(d.scale);
  const sCols = Math.ceil(TILE_CELLS / step), sRows = sCols;
  const heights = new Float64Array(sCols * sRows);
  for (let j = 0; j < sRows; j++) {
    for (let i = 0; i < sCols; i++) {
      heights[j * sCols + i] = M._approxSurfaceY(
        d.originX + (i * step + step / 2) * d.scale,
        d.originZ + (j * step + step / 2) * d.scale);
    }
  }
  const shade = upsampleShade(hillshade(heights, sCols, sRows, step * d.scale),
    sCols, sRows, step, TILE_CELLS, TILE_CELLS);
  for (let i = 0; i < shade.length; i++) {
    const s = shade[i];
    rgba[i * 4] *= s; rgba[i * 4 + 1] *= s; rgba[i * 4 + 2] *= s;
  }
}

// render one biome tile (RGBA + present-biome set) for the requested view
function handleRender(d) {
  applyWorld(d.seed, d.mc, d.large, d.dim);
  const scale = chooseScale(d.bpp);
  // world block bounds of the viewport, scaled NW corner and cell grid size
  const sx0 = Math.floor((d.cx - d.w * d.bpp / 2) / scale);
  const sz0 = Math.floor((d.cz - d.h * d.bpp / 2) / scale);
  const cols = Math.ceil((d.w * d.bpp) / scale) + 1;
  const rows = Math.ceil((d.h * d.bpp) / scale) + 1;
  ensureArea(cols * rows);
  const ok = M._genBiomeArea(areaPtr, sx0, sz0, cols, rows, scale, scaledY(d.y));
  const rgba = new Uint8ClampedArray(cols * rows * 4);
  const present = new Set();
  // hovering a legend entry re-renders with `highlight`: other biomes dim
  const hl = Number.isInteger(d.highlight) ? d.highlight : null;
  if (ok) paintTile(rgba, present, cols * rows, hl);
  postMessage({
    type: 'tile', reqId: d.reqId, ok: !!ok, rgba: rgba.buffer, cols, rows, scale, present: [...present], highlight: hl,
    // world coords of the cell-grid NW corner, for placement on the map
    originX: sx0 * scale, originZ: sz0 * scale
  }, [rgba.buffer]);
}
function paintTile(rgba, present, cells, hl) {
  const base = areaPtr >> 2;
  for (let i = 0; i < cells; i++) {
    let id = M.HEAP32[base + i];
    if (id < 0 || id > 255) id = 0;
    present.add(id);
    const c = id * 3;
    const dim = hl !== null && id !== hl ? 0.3 : 1;
    rgba[i * 4] = colors[c] * dim;
    rgba[i * 4 + 1] = colors[c + 1] * dim;
    rgba[i * 4 + 2] = colors[c + 2] * dim;
    rgba[i * 4 + 3] = 255;
  }
}
function handleStructures(d) {
  applyWorld(d.seed, d.mc, d.large, d.dim);
  const cap = 4000;
  ensureList(cap);
  const out = [];
  for (const st of d.types) {
    if (st === SLIME_STRUCT_TYPE) {
      out.push({ type: st, points: slimeLayerPoints(d) });
      continue;
    }
    out.push({ type: st, points: pointsOfType(st, d.dim, d.x0, d.z0, d.x1, d.z1, cap) });
  }
  postMessage({ type: 'structures', reqId: d.reqId, groups: out });
}

// message dispatch table: one handler per message type
function handleBiomeMsg(d) {
  applyWorld(d.seed, d.mc, d.large, d.dim);
  const id = M._biomeAtBlock(d.x, d.z, Number.isInteger(d.y) ? d.y : DEFAULT_Y);
  postMessage({ type: 'biome', reqId: d.reqId, id, name: M.UTF8ToString(M._biomeName(id)) });
}
function handleSearchMsg(d) {
  if (searchBusy) {
    postMessage({ type: 'search', reqId: d.reqId, error: 'busy', hits: [], ms: 0 });
    return;
  }
  runSearchJob(d); // async: runs in slices so tiles/cancel stay responsive
}
function handlePaletteMsg(d) {
  // swap the active color table; tiles rendered after this repaint with it
  if (d.alt && !altColors) altColors = altBiomeColors(baseColors);
  colors = d.alt ? altColors : baseColors;
}
function handleBiomeListMsg() {
  // enumerate valid biome ids + names + colors for the dropdowns
  const list = [];
  for (let id = 0; id <= 255; id++) {
    const name = M.UTF8ToString(M._biomeName(id));
    if (!name) continue;
    list.push({ id, name, dim: M._biomeDimension(id), rgb: [colors[id * 3], colors[id * 3 + 1], colors[id * 3 + 2]] });
  }
  postMessage({ type: 'biomeList', list });
}
const HANDLERS = {
  tileGen: (d) => { tileGen = d.gen; },
  renderTile: handleRenderTile,
  render: handleRender,
  structures: handleStructures,
  biome: handleBiomeMsg,
  cancelSearch: (d) => { searchCancelId = d.reqId; },
  seedSearch: runSeedSearchJob, // async: yields between seeds so cancel is processed
  cancelSeedSearch: (d) => { seedCancelId = d.reqId; },
  search: handleSearchMsg,
  palette: handlePaletteMsg,
  structConsts: (d) => postMessage({ type: 'structConsts', values: d.indices.map((i) => M._structConst(i)) }),
  biomeList: handleBiomeListMsg
};

onmessage = (e) => {
  if (!ready) { /* messages before ready are re-sent by main */ return; }
  const handler = HANDLERS[e.data.type];
  if (handler) handler(e.data);
};
