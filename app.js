// app.js — UI, map rendering, search orchestration. Talks to worker.js.
// ES module: every pure-logic helper is an explicit import below; the
// worker-shared modules (seed.js, slime.js, markers.js, palette.js,
// tilegrid.js, search.js) are plain ES modules too (#224 MR 3).
import { t, applyI18n, setLang, currentLang, I18N_LANGS } from './i18n.js';
import { biomeLabel } from './biomes.js';
import { convertCoords } from './coords.js';
import { portalPlan } from './portals.js';
import { PRESETS, presetCriteria } from './presets.js';
import { parseFavorites, addFavorite, findFavorite, removeFavorite, updateFavoriteNote, favoritesFor } from './favorites.js';
import { legendEntries } from './legend.js';
import {
  scaleBarSpec, gridSpec, gridLines, minimapZoomOut, minimapClickToWorld,
  viewportRectOnMinimap, parseGotoInput, rulerMeasure, linkedGridSpec, normalizeRect, formatRect
} from './maptools.js';
import { tileWorldKey, tileKey, createTileCache, tilesInView } from './tilecache.js';
import {
  encodeShareHash, decodeShareHash, normalizeLegacyCriteria,
  sanitizeCriteria, sanitizeWorldView, worldToScreen, screenToWorld
} from './sharestate.js';
import {
  SEED_SEARCH_MAX_TOTAL, SEED_SEARCH_MAX_FOUND, sequentialSeeds, randomSeeds,
  planBatches, originDist, insertCandidate, serializeSeedRun, parseSeedRun
} from './seedsearch.js';
import { addHistoryEntry, parseHistory } from './searchhistory.js';
import { USER_PRESET_NAME_MAX, addUserPreset, removeUserPreset, parseUserPresets } from './userpresets.js';
import { addMarker, removeMarker, renameMarker, markersFor, parseMarkers, mergeMarkers } from './usermarkers.js';
import { ZONE_COLORS, ZONE_NAME_MAX, addZone, removeZone, renameZone, recolorZone, zonesFor, parseZones } from './userzones.js';
import { exportProfile, parseProfile, mergeProfile } from './profile.js';
import { validateGallery, galleryText, galleryThumbRender, galleryStructRender, galleryThumbPoint } from './gallery.js';
import { THEME_COLORS, resolveTheme, otherTheme } from './theme.js';
import {
  resultsToCSV, resultsToJSON, mapCartoucheLines, exportFileName, parseLocationsCSV,
  hdExportGeometry, cartoucheMetrics
} from './export.js';
import { APP_VERSION } from './version.js';
import { formatErrorEvent } from './errorreport.js';
import { TOUR_SEEN_KEY, TOUR_STEPS, isFirstVisit, isLastStep, nextStep, tourBubblePosition } from './tour.js';
import { sortHitsByDist } from './search.js';
import { keyAction } from './keys.js';
import { RARE_BIOMES, RARE_MAX_RADIUS } from './rarebiomes.js';
import { SLIME_STRUCT_TYPE } from './slime.js';
import { SPAWN_STRUCT_TYPE, STRONGHOLD_STRUCT_TYPE, QUADHUT_STRUCT_TYPE } from './markers.js';
import { altRgb } from './palette.js';
import { TILE_GRID_CACHE_MAX, TILE_PAINT_MAX, renderScaleFor, tilesForView, unionPresent } from './tilegrid.js';
import {
  panViewport, zoomViewportAt, compareWorldFor, createCompareState, enterCompare, exitCompare,
  structQueryRect, structuresRequestFor
} from './compare.js';

// Two instances of the same engine worker: tiles/probes/structures on one,
// the sliced search job on the other, so a long search never delays a tile
// render or a biome probe (at the cost of a second WASM instance in memory).
const worker = new Worker('./worker.js', { type: 'module' });
const searchWorker = new Worker('./worker.js', { type: 'module' });
let MC_NEWEST = 28;
let reqSeq = 1;

// ---------- DOM ----------
const $ = (s) => document.querySelector(s);
const canvas = $('#map'), ctx = canvas.getContext('2d');
const hud = $('#hud'), resultsEl = $('#results'), searchInfo = $('#searchInfo');

// ---------- state ----------
const world = { seed: '141', mc: MC_NEWEST, large: false, dim: 0 };
let yLayer = 60;                                // altitude for tiles, probe and search
// [value, canonical English name (kept in data exports), i18n key for the UI]
const DIMENSIONS = [[0, 'Overworld', 'dimOverworld'], [-1, 'Nether', 'dimNether'], [1, 'End', 'dimEnd']];
const view = { cx: -392, cz: 56, bpp: 2.2 };   // bpp = blocks per pixel
let tile = null;                                // {canvas, originX, originZ, scale, cols, rows}
let pins = [];                                  // [{x,z,count}] as displayed (sorted)
let basePins = [];                              // pins in engine (search) order
let lastSpawn = null;                           // world spawn of the last search
let rarePin = null;                             // {x,z} temporary rare-biome pin (#252)
let sortMode = 'order';                         // 'order' | 'spawn'
let selected = -1;
// ruler tool: a/b world endpoints, b tracks the pointer until the 2nd click
const ruler = { on: false, a: null, b: null, done: false };
// selection tool: a/b world corners dragged on the map
const sel = { on: false, a: null, b: null, done: false };
// zone tool: a/b world corners dragged on the map, turned into a named zone
const zoneTool = { on: false, a: null, b: null };
// portal calculator (#284): the placed portal {dim,x,z}; survives dimension
// switches so the linked pin shows up in the other dimension
let portal = null;
let portalMode = false;
const structColors = ['#f2a73b','#7ee0c0','#c89bf0','#e07a7a','#7aa8e0','#d8d05a','#9ad06a','#e0a0c8'];
let structToggles = [];                         // [{type,label,on,color,points}]
let renderReq = 0, biomeProbeReq = 0;
let showGrid = false;                           // coordinate-grid overlay toggle
let showNetherGrid = false;                     // linked-dimension (portal) grid overlay
let showRelief = false;                         // hillshade terrain overlay (Overworld)
// relief tiles are only requested (and keyed) in the Overworld
function reliefOn() { return showRelief && world.dim === 0; }
const tileCache = createTileCache(TILE_GRID_CACHE_MAX); // LRU of small grid tiles (pan/zoom reuse)
let minimapReq = 0, minimapTile = null;         // overview minimap tile
const galleryThumbReqs = new Map();             // in-flight gallery thumbnails: reqId -> {e, cv}
const galleryStructReqs = new Map();            // in-flight thumbnail structures: reqId -> {e, cv, colors}

// Privacy-preserving error reporting: a small, PII-free event sent to Umami
// (if loaded) so production crashes are visible without a third-party SDK —
// never includes the seed, coordinates or any user input (see errorreport.js).
function sendErrorEvent(kind, message, source, line) {
  if (typeof umami === 'undefined' || typeof umami.track !== 'function') return;
  try { umami.track('error', formatErrorEvent(kind, message, source, line)); } catch { /* ignore */ }
}
window.addEventListener('error', (e) => sendErrorEvent('error', e.message, e.filename, e.lineno));
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  sendErrorEvent('promise', reason?.message || reason);
});

// ---------- worker plumbing ----------
// per-worker readiness + queue of messages sent before the engine was up
for (const w of [worker, searchWorker]) {
  w.engineReady = false;
  w.pending = [];
  w.onerror = (e) => { console.error('WORKER ERROR:', e.message, e.filename, e.lineno); sendErrorEvent('worker', e.message, e.filename, e.lineno); };
  w.onmessageerror = (e) => console.error('WORKER MSGERROR', e);
}
function post(w, msg, transfer) {
  if (!w.engineReady) { w.pending.push([msg, transfer]); return; }
  w.postMessage(msg, transfer || []);
}
function send(msg, transfer) { post(worker, msg, transfer); }
function sendSearch(msg) { post(searchWorker, msg); }
function engineUp(w) {
  w.engineReady = true;
  w.pending.forEach(([m, t]) => w.postMessage(m, t || []));
  w.pending.length = 0;
}
searchWorker.onmessage = (e) => {
  const d = e.data;
  if (d.type === 'fatal') { showFatal(d.message); return; }
  if (d.type === 'ready') { engineUp(searchWorker); return; }
  if (d.type === 'searchProgress') {
    if (d.reqId === searchReq) $('#searchProgress').value = d.pct;
    return;
  }
  if (d.type === 'rareProgress') {
    if (d.reqId === rareReq) $('#rareProgress').value = d.pct;
    return;
  }
  if (d.type === 'rare') { onRareResult(d); return; }
  if (d.type === 'exportBand') { onExportBand(d); return; }
  if (d.type === 'exportDone') { onExportDone(d); return; }
  if (d.type === 'search') onSearchResult(d);
};
// engine startup: version list first, then the biome list ahead of any
// queued render so the legend and dropdowns can resolve ids
function onEngineReady(d) {
  MC_NEWEST = d.mcNewest;
  if (!Number.isInteger(world.mc) || world.mc < 1 || world.mc > MC_NEWEST) world.mc = MC_NEWEST;
  buildVersionSelect();
  worker.engineReady = true;
  worker.postMessage({ type: 'biomeList' });
  engineUp(worker);
}
function tileCanvasOf(d) {
  const tmp = document.createElement('canvas');
  tmp.width = d.cols; tmp.height = d.rows;
  tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(d.rgba), d.cols, d.rows), 0, 0);
  return { canvas: tmp, originX: d.originX, originZ: d.originZ, scale: d.scale, cols: d.cols, rows: d.rows };
}
function onTileMessage(d) {
  const thumb = galleryThumbReqs.get(d.reqId);
  if (thumb) {
    // gallery card preview: scale the rendered area onto the card canvas,
    // then overlay the structure markers of the spot
    galleryThumbReqs.delete(d.reqId);
    if (d.ok) {
      thumb.cv.getContext('2d').drawImage(tileCanvasOf(d).canvas, 0, 0, thumb.cv.width, thumb.cv.height);
      requestGalleryStructs(thumb.e, thumb.cv);
    }
    return;
  }
  if (d.reqId === minimapReq) {
    if (!d.ok) return;
    minimapTile = tileCanvasOf(d);
    drawMinimap();
    return;
  }
  if (d.reqId !== renderReq) return;            // stale
  if (!d.ok) {
    searchInfo.textContent = t('tileFailed');
    searchInfo.className = 'info err';
    return;
  }
  tile = tileCanvasOf(d);
  // highlight re-renders keep the legend DOM intact (hover must survive);
  // they also carry dimmed pixels, so only plain tiles enter the cache
  if (d.highlight == null) {
    const wk = tileWorldKey(world, yLayer, reliefOn());
    tileCache.put({ ...tile, worldKey: wk, key: tileKey(wk, d.scale, d.originX, d.originZ) });
    buildLegend(d.present || []);
  }
  draw();
}
let gridRefillTimer = null;
function onGridTile(d) {
  if (d.skipped) {
    // drop the in-flight marker only if it belongs to the cancelled request:
    // the tile may already have been re-requested with the current generation
    if (pendingTiles.get(d.key) === d.gen) pendingTiles.delete(d.key);
    pumpTileQueue();
    // A cancelled batch can strand tiles of the CURRENT view: they were
    // still marked in-flight when the new batch was requested, so its loop
    // skipped them. Refill the gaps once the cancel acks settle — without
    // bumping the generation, or the refill would cancel its own batch.
    clearTimeout(gridRefillTimer);
    gridRefillTimer = setTimeout(() => requestGridTiles(false), 60);
    return;
  }
  pendingTiles.delete(d.key);
  pumpTileQueue();
  if (!d.ok) {
    searchInfo.textContent = t('tileFailed');
    searchInfo.className = 'info err';
    return;
  }
  const entry = { ...tileCanvasOf(d), worldKey: d.wk, key: d.key, present: d.present };
  tileCache.put(entry);
  // tiles of a previous world/altitude are cached but not drawn
  if (d.wk !== tileWorldKey(world, yLayer, reliefOn())) return;
  draw();
  refreshLegendFromView();
}
worker.onmessage = (e) => {
  const d = e.data;
  if (d.type === 'fatal') { showFatal(d.message); return; }
  if (d.type === 'ready') { onEngineReady(d); return; }
  if (d.type === 'biomeList') { onBiomeList(d.list); return; }
  if (d.type === 'tile') { onTileMessage(d); return; }
  if (d.type === 'gridTile') { onGridTile(d); return; }
  if (d.type === 'structures') {
    // thumbnail requests are routed to their card and must never clobber
    // the main map's layer points
    if (galleryStructReqs.has(d.reqId)) { drawGalleryStructs(d); return; }
    d.groups.forEach((g) => { const t = structToggles.find((s) => s.type === g.type); if (t) t.points = g.points; });
    draw();
    return;
  }
  if (d.type === 'biome' && d.reqId === biomeProbeReq) {
    hud.querySelector('.biome').textContent = d.name ? biomeLabel(d.name) : '—';
    markLegend(d.id);
  }
};

// toggle the search button between Search and Cancel + show the progress bar
let searchReq = 0, searchBusy = false;
function setSearchBusy(on) {
  searchBusy = on;
  const btn = $('#searchBtn');
  btn.dataset.i18n = on ? 'cancelBtn' : 'searchBtn';
  btn.textContent = t(btn.dataset.i18n);
  const prog = $('#searchProgress');
  prog.hidden = !on;
  prog.value = 0;
}

// Unrecoverable worker/WASM failure: tell the user instead of hanging silently.
function showFatal(message) {
  searchInfo.textContent = message + ' ' + t('reloadRetry');
  searchInfo.className = 'info err';
  $('#searchBtn').disabled = true;
  $('#loadBtn').disabled = true;
}

// Clipboard needs a secure context; fall back to execCommand over plain http.
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    // deprecated, but it is the only copy mechanism available on insecure
    // (plain http) contexts, which this fallback exists for. NOSONAR
    try { document.execCommand('copy') ? resolve() : reject(new Error('copy rejected')); } // NOSONAR javascript:S1874
    catch (err) { reject(err); }
    finally { ta.remove(); }
  });
}

// ---------- generation version ----------
// cubiomes MCVersion enum values (biomes.h). The engine reports MC_NEWEST at
// startup; if it disagrees with this table (different cubiomes build), only
// the engine's newest version is offered so labels can never lie.
const MC_VERSIONS = [
  [28, '1.21'], [27, '1.21.3'], [26, '1.21.1'], [25, '1.20'],
  [24, '1.19'], [23, '1.19.2'], [22, '1.18'], [21, '1.17'],
  [20, '1.16'], [19, '1.16.1'], [18, '1.15'], [17, '1.14'],
  [16, '1.13'], [15, '1.12'], [14, '1.11'], [13, '1.10'],
  [12, '1.9'], [11, '1.8'], [10, '1.7'], [9, '1.6'],
  [8, '1.5'], [7, '1.4'], [6, '1.3'], [5, '1.2'], [4, '1.1'], [3, '1.0']
];
function buildVersionSelect() {
  const sel = $('#mcver'), cmp = $('#cmpVer');
  sel.textContent = ''; cmp.textContent = '';
  const versions = MC_VERSIONS[0][0] === MC_NEWEST ? MC_VERSIONS : [[MC_NEWEST, 'newest']];
  // explicit translated placeholder so version comparison is discoverable (#271);
  // data-i18n keeps it translated when the language changes
  const off = document.createElement('option');
  off.value = ''; off.textContent = t('cmpVerNone'); off.dataset.i18n = 'cmpVerNone';
  cmp.appendChild(off);
  for (const [v, label] of versions) {
    const o = document.createElement('option');
    o.value = v; o.textContent = label;
    sel.appendChild(o);
    cmp.appendChild(o.cloneNode(true));
  }
  sel.value = String(world.mc);
  if (sel.value === '') { world.mc = MC_NEWEST; sel.value = String(MC_NEWEST); }
  sel.onchange = () => {
    world.mc = Number.parseInt(sel.value, 10);
    curReset(); draw(); requestRender(0); syncHash();
  };
  cmp.onchange = () => { $('#cmpSwap').hidden = cmp.value === ''; };
  // A/B swap: the tile cache is keyed by version, so flipping back and
  // forth repaints instantly from cache once both sides have rendered
  $('#cmpSwap').onclick = swapCompareVersion;
}
function swapCompareVersion() {
  const sel = $('#mcver'), cmp = $('#cmpVer');
  if (cmp.value === '' || cmp.value === sel.value) return;
  const other = Number.parseInt(cmp.value, 10);
  cmp.value = String(world.mc);
  world.mc = other;
  sel.value = String(other);
  // structures and pins belong to the previous version's world
  structToggles.forEach((tg) => { tg.points = null; });
  hidePopup();
  draw(); requestRender(0); syncHash();
}

// ---------- dimension ----------
function buildDimSelect() {
  const sel = $('#dimSel');
  for (const [v, , key] of DIMENSIONS) {
    const o = document.createElement('option');
    // data-i18n keeps the option translated when the language changes
    o.value = v; o.textContent = t(key); o.dataset.i18n = key;
    sel.appendChild(o);
  }
  sel.value = String(world.dim);
  sel.onchange = () => setDimension(Number.parseInt(sel.value, 10));
}
function setDimension(dim) {
  world.dim = dim;
  // the End has no linked dimension: hide and disarm the portal grid
  const lbl = $('#netherToggleLbl');
  if (lbl) {
    lbl.hidden = dim === 1;
    if (dim === 1) { showNetherGrid = false; $('#netherChk').checked = false; }
  }
  // the End has no linked dimension either: hide and disarm the portal tool
  const pbtn = $('#portalBtn');
  if (pbtn) {
    pbtn.hidden = dim === 1;
    if (dim === 1 && portalMode) setPortalMode(false);
  }
  // surface relief only exists in the Overworld
  const rlbl = $('#reliefToggleLbl');
  if (rlbl) rlbl.hidden = dim !== 0;
  // the rare-biome shortcuts are Overworld biomes only
  const rareCard = $('#rareCard');
  if (rareCard) rareCard.hidden = dim !== 0;
  // criteria and layers reference biomes/structures of the old dimension: rebuild
  $('#mainBiomes').textContent = ''; $('#adjClauses').textContent = ''; $('#structClauses').textContent = ''; $('#pctClauses').textContent = ''; $('#shapeClauses').textContent = '';
  $('#pairClauses').textContent = '';
  collapseCritSections();
  const presetSel = $('#presetSel');
  if (presetSel) presetSel.value = '';   // criteria no longer match any preset
  addMainBiomeRow();
  structToggles.forEach((tg) => { tg.on = false; tg.points = null; });
  buildStructToggleUI();
  hidePopup();
  pins = []; basePins = []; resultsEl.textContent = ''; $('#exportBtns').hidden = true; $('#sortCtl').hidden = true;
  curReset(); draw(); requestRender(0); syncHash();
}

// ---------- coordinate transforms ----------
// thin wrappers over the pure transforms (sharestate.js), bound to the canvas
function w2sx(wx) { return worldToScreen(view, canvas.width / dpr, canvas.height / dpr, wx, 0).x; }
function w2sy(wz) { return worldToScreen(view, canvas.width / dpr, canvas.height / dpr, 0, wz).y; }
function s2wx(px) { return screenToWorld(view, canvas.width / dpr, canvas.height / dpr, px, 0).x; }
function s2wz(py) { return screenToWorld(view, canvas.width / dpr, canvas.height / dpr, 0, py).z; }

// ---------- rendering ----------
let dpr = window.devicePixelRatio || 1;
function resize() {
  dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  if (cmpState.on) {
    const r2 = cmpCanvas.getBoundingClientRect();
    cmpCanvas.width = Math.round(r2.width * dpr);
    cmpCanvas.height = Math.round(r2.height * dpr);
  }
  draw(); requestRender();
}
window.addEventListener('resize', resize);

function draw() {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = canvas.width / dpr, H = canvas.height / dpr;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = mapBg; ctx.fillRect(0, 0, W, H);

  ctx.imageSmoothingEnabled = false;
  if (highlightBiome !== null && tile) {
    // highlight tiles are dimmed: cached plain tiles must not show around them
    drawTile(tile);
  } else {
    // paint every cached tile of this world under the view: known areas render
    // instantly while the fresh tile is being computed (coarse first, then fine)
    const rect = { x0: s2wx(0), z0: s2wz(0), x1: s2wx(W), z1: s2wz(H) };
    // bounded: overdrawing the whole LRU every drag frame costs frame time —
    // but the bound must cover the view (a deep zoom-out needs more tiles
    // than the default budget, or rendered areas simply never get painted)
    const cap = Math.max(TILE_PAINT_MAX, tilesForView(view, W, H, renderScaleFor(view.bpp)).length);
    for (const e of tilesInView(tileCache.entries(), tileWorldKey(world, yLayer, reliefOn()), rect, cap, renderScaleFor(view.bpp))) {
      // touching every painted tile keeps the whole visible set at the fresh
      // end of the LRU, so evictions only ever take off-screen tiles
      tileCache.touch(e.key);
      drawTile(e);
    }
  }

  // named zone annotations sit right above the tiles, under every marker
  drawZones(W, H);

  drawStructLayers(ctx, W, H, (tg) => tg.points);

  drawFavMarkers(W, H);
  drawUserMarkers(W, H);
  drawPortal();

  // result pins
  pins.forEach((p, i) => {
    const sx = w2sx(p.x), sy = w2sy(p.z);
    drawPin(sx, sy, i === selected);
  });
  // temporary "nearest rare biome" pin (#252), cleared with the popup
  if (rarePin) drawPin(w2sx(rarePin.x), w2sy(rarePin.z), true);

  if (showGrid) drawGrid(W, H);
  if (showNetherGrid) drawNetherGrid(W, H);
  drawScaleBar(H);
  drawRuler();
  drawSelection();

  // center crosshair
  ctx.strokeStyle = curTheme === 'light' ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 2 - 7, H / 2); ctx.lineTo(W / 2 + 7, H / 2);
  ctx.moveTo(W / 2, H / 2 - 7); ctx.lineTo(W / 2, H / 2 + 7); ctx.stroke();
  ctx.restore();

  // the compare pane shares the viewport: every main-map redraw refreshes it
  if (cmpState.on) drawCompare();
}

// structure / slime layers (only points in view); the same toggles drive
// both panes — `pointsOf` picks the per-pane dataset (seed-A points live on
// the toggle, seed-B points in the compare store) and `g` the target canvas
function drawStructLayers(g, W, H, pointsOf) {
  for (const tg of structToggles) {
    if (!tg.on) continue;
    const points = pointsOf(tg);
    if (!points) continue;
    if (tg.slime) drawSlimeLayer(g, points, W, H);
    else drawStructMarkers(g, tg.color, points, W, H);
  }
}

function drawTile(e) {
  const px = w2sx(e.originX), py = w2sy(e.originZ);
  ctx.drawImage(e.canvas, px, py, e.cols * e.scale / view.bpp, e.rows * e.scale / view.bpp);
}

// stroke every grid line of `step` across the viewport (shared by the
// coordinate grid and the linked-dimension overlay)
function strokeGridLines(W, H, step) {
  ctx.beginPath();
  for (const wx of gridLines(s2wx(0), s2wx(W), step)) {
    const px = w2sx(wx);
    ctx.moveTo(px, 0); ctx.lineTo(px, H);
  }
  for (const wz of gridLines(s2wz(0), s2wz(H), step)) {
    const py = w2sy(wz);
    ctx.moveTo(0, py); ctx.lineTo(W, py);
  }
  ctx.stroke();
}

// adaptive coordinate grid: chunk/region multiples with edge labels
function drawGrid(W, H) {
  const { step } = gridSpec(view.bpp);
  const line = curTheme === 'light' ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.13)';
  const label = curTheme === 'light' ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.5)';
  ctx.strokeStyle = line; ctx.lineWidth = 1;
  ctx.fillStyle = label; ctx.font = '10px monospace';
  strokeGridLines(W, H, step);
  for (const wx of gridLines(s2wx(0), s2wx(W), step)) ctx.fillText(String(wx), w2sx(wx) + 3, 11);
  for (const wz of gridLines(s2wz(0), s2wz(H), step)) ctx.fillText(String(wz), 3, w2sy(wz) - 3);
}

// portal-planning overlay: dashed lines on "nice" steps of the LINKED
// dimension (Nether seen from the Overworld and vice versa), labelled with
// the linked coordinates
function drawNetherGrid(W, H) {
  const spec = linkedGridSpec(world.dim, view.bpp);
  if (!spec) return;
  const step = spec.currentStep;
  ctx.save();
  ctx.strokeStyle = 'rgba(226,110,60,.55)'; ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.fillStyle = 'rgba(226,110,60,.9)'; ctx.font = '10px monospace';
  strokeGridLines(W, H, step);
  for (const wx of gridLines(s2wx(0), s2wx(W), step)) {
    ctx.fillText(`${spec.label} ${Math.round(wx / spec.factor)}`, w2sx(wx) + 3, 23);
  }
  for (const wz of gridLines(s2wz(0), s2wz(H), step)) {
    ctx.fillText(String(Math.round(wz / spec.factor)), 3, w2sy(wz) + 11);
  }
  ctx.restore();
}

// graphic scale bar, bottom-left above the HUD
function drawScaleBar(H) {
  const { blocks, px } = scaleBarSpec(view.bpp);
  const x = 15, y = H - 56;
  ctx.strokeStyle = mapText; ctx.fillStyle = mapText; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + px, y); ctx.lineTo(x + px, y - 4);
  ctx.stroke();
  ctx.font = '11px monospace';
  ctx.fillText(`${blocks} ${t('blocks')}`, x, y - 7);
}

// ruler segment with its endpoints and a distance label at the midpoint
function drawRuler() {
  if (!ruler.on || !ruler.a || !ruler.b) return;
  const x1 = w2sx(ruler.a.x), y1 = w2sy(ruler.a.z);
  const x2 = w2sx(ruler.b.x), y2 = w2sy(ruler.b.z);
  ctx.strokeStyle = '#e8b23c'; ctx.fillStyle = '#e8b23c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  for (const [px, py] of [[x1, y1], [x2, y2]]) {
    ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  const m = rulerMeasure(ruler.a, ruler.b);
  const label = `${m.dist} ${t('blocks')} (Δx ${m.dx} · Δz ${m.dz})`;
  ctx.font = '12px monospace';
  const tw = ctx.measureText(label).width;
  const lx = (x1 + x2) / 2 - tw / 2, ly = (y1 + y2) / 2 - 10;
  ctx.fillStyle = curTheme === 'light' ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.65)';
  ctx.fillRect(lx - 4, ly - 12, tw + 8, 17);
  ctx.fillStyle = '#e8b23c';
  ctx.fillText(label, lx, ly);
}

function drawSelection() {
  if (!sel.on || !sel.a || !sel.b) return;
  const r = normalizeRect(sel.a, sel.b);
  const x = w2sx(r.x0), y = w2sy(r.z0);
  const w = w2sx(r.x1) - x, h = w2sy(r.z1) - y;
  ctx.save();
  ctx.fillStyle = 'rgba(91,136,245,.15)';
  ctx.strokeStyle = 'rgba(91,136,245,.9)'; ctx.lineWidth = 1.5;
  ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = 'rgba(91,136,245,1)'; ctx.font = '11px monospace';
  ctx.fillText(`${r.w} × ${r.h}`, x + 4, y - 5);
  ctx.restore();
}
function setSelOn(on) {
  sel.on = on; sel.a = null; sel.b = null; sel.done = false;
  $('#selBtn').classList.toggle('on', on);
  $('#selBar').hidden = true;
  canvas.style.cursor = on ? 'crosshair' : '';
  draw();
}
function showSelBar() {
  const bar = $('#selBar');
  bar.hidden = false;
  const r = normalizeRect(sel.a, sel.b);
  $('#selInfo').textContent = formatRect(r);
}
// crop the current canvas to the selection and download it as PNG
function exportSelectionPNG() {
  if (!sel.a || !sel.b) return;
  const r = normalizeRect(sel.a, sel.b);
  const px = Math.round(w2sx(r.x0) * dpr), py = Math.round(w2sy(r.z0) * dpr);
  const pw = Math.max(1, Math.round((r.w / view.bpp) * dpr));
  const ph = Math.max(1, Math.round((r.h / view.bpp) * dpr));
  const out = document.createElement('canvas');
  out.width = pw; out.height = ph;
  out.getContext('2d').drawImage(canvas, px, py, pw, ph, 0, 0, pw, ph);
  out.toBlob((blob) => { if (blob) downloadBlob(exportFileName(world.seed, 'selection', 'png'), blob); }, 'image/png');
}
// semi-transparent named rectangles in world coordinates; zones of the
// linked dimension render converted (1:8) with a dashed border
function drawZones(W, H) {
  ctx.save();
  ctx.font = '12px monospace';
  for (const d of zonesFor(userZones, world)) {
    const x = w2sx(d.x0), y = w2sy(d.z0);
    const w = w2sx(d.x1) - x, h = w2sy(d.z1) - y;
    if (x > W || y > H || x + w < 0 || y + h < 0) continue;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = d.zone.color;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = d.zone.color; ctx.lineWidth = 2;
    ctx.setLineDash(d.converted ? [5, 4] : []);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = d.zone.color;
    ctx.fillText(d.zone.name, x + 4, y - 5);
  }
  // live preview of the rectangle being dragged
  if (zoneTool.on && zoneTool.a && zoneTool.b) {
    const r = normalizeRect(zoneTool.a, zoneTool.b);
    const x = w2sx(r.x0), y = w2sy(r.z0);
    ctx.strokeStyle = ZONE_COLORS[0]; ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x, y, w2sx(r.x1) - x, w2sy(r.z1) - y);
  }
  ctx.restore();
}
function setZoneOn(on) {
  zoneTool.on = on; zoneTool.a = null; zoneTool.b = null;
  $('#zoneBtn').classList.toggle('on', on);
  canvas.style.cursor = on ? 'crosshair' : '';
  draw();
}
// drag finished: create the zone, leave the tool and open its editor
function finishZoneDrag() {
  const next = addZone(userZones, {
    ...world, x0: zoneTool.a.x, z0: zoneTool.a.z, x1: zoneTool.b.x, z1: zoneTool.b.z
  });
  const created = next.length > userZones.length ? next.at(-1) : null;
  setUserZones(next);
  setZoneOn(false);
  if (created) showZoneEditor(created);
}
// topmost zone under a screen point, or null
function zoneAt(mx, my) {
  const zs = zonesFor(userZones, world);
  for (let i = zs.length - 1; i >= 0; i--) {
    const d = zs[i];
    if (mx >= w2sx(d.x0) && mx <= w2sx(d.x1) && my >= w2sy(d.z0) && my <= w2sy(d.z1)) return d;
  }
  return null;
}
// small editor in the map popup: rename, pick a palette color, delete
function zoneColorButton(z, c, box) {
  const b = document.createElement('button');
  b.className = 'zone-color';
  b.style.background = c;
  b.setAttribute('aria-pressed', String(c === z.color));
  b.setAttribute('aria-label', `${t('zoneColorAria')} ${c}`);
  b.onclick = () => {
    setUserZones(recolorZone(userZones, z.id, c));
    [...box.children].forEach((el) => el.setAttribute('aria-pressed', String(el === b)));
  };
  return b;
}
function showZoneEditor(z) {
  const pop = $('#popup');
  pop.textContent = '';
  pop.setAttribute('aria-label', z.name);
  const close = document.createElement('button');
  close.className = 'pop-close'; close.textContent = '×'; close.title = t('close');
  close.onclick = hidePopup;
  const name = document.createElement('input');
  name.className = 'zone-name mono'; name.value = z.name;
  name.maxLength = ZONE_NAME_MAX;
  name.placeholder = t('zoneNamePh');
  name.setAttribute('aria-label', t('zoneNamePh'));
  name.onchange = () => setUserZones(renameZone(userZones, z.id, name.value));
  const colors = document.createElement('div');
  colors.className = 'zone-colors';
  for (const c of ZONE_COLORS) colors.appendChild(zoneColorButton(z, c, colors));
  const del = document.createElement('button');
  del.className = 'btn tiny zone-del'; del.textContent = t('zoneDelete');
  del.onclick = () => { setUserZones(removeZone(userZones, z.id)); hidePopup(); };
  pop.append(close, name, colors, del);
  if (!pop.open) pop.show();
}
// ---------- portal calculator (#284) ----------
// source pin in its own dimension; ideal linked destination pin plus the
// portal-search radius circle (128 Overworld / 16 Nether blocks) in the other
function drawPortal() {
  if (!portal) return;
  const plan = portalPlan(portal.dim, portal.x, portal.z);
  if (world.dim === plan.src.dim) drawPortalPin(plan.src, false);
  if (world.dim === plan.dest.dim) {
    const sx = w2sx(plan.dest.x), sy = w2sy(plan.dest.z);
    ctx.save();
    ctx.strokeStyle = 'rgba(168,85,247,.85)'; ctx.fillStyle = 'rgba(168,85,247,.12)';
    ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.arc(sx, sy, plan.radius / view.bpp, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    drawPortalPin(plan.dest, true);
  }
}
// a portal renders as a small upright obsidian frame
function drawPortalPin(p, dest) {
  const sx = w2sx(p.x), sy = w2sy(p.z);
  ctx.save();
  ctx.fillStyle = dest ? '#7c3aed' : '#a855f7';
  ctx.strokeStyle = 'rgba(24,10,40,.85)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.rect(sx - 4, sy - 7, 8, 14);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}
function setPortalMode(on) {
  portalMode = on;
  $('#portalBtn').classList.toggle('on', on);
  canvas.style.cursor = on ? 'crosshair' : '';
}
function placePortal(x, z) {
  // no portal pair exists for the End: leave the tool without placing
  if (!portalPlan(world.dim, x, z)) { setPortalMode(false); return; }
  portal = { dim: world.dim, x, z };
  setPortalMode(false);
  draw();
  showPortalPopup();
}
// true when a portal pin (source or destination) of the current dimension
// sits under the screen point
function portalPinAt(mx, my) {
  const plan = portalPlan(portal.dim, portal.x, portal.z);
  return [plan.src, plan.dest].some((p) =>
    p.dim === world.dim && Math.hypot(mx - w2sx(p.x), my - w2sy(p.z)) < 10);
}
// one "Dimension · x, z  [Copy /tp]" line of the portal popup
function portalCoordRow(p) {
  const row = document.createElement('div');
  row.className = 'pop-portal-row';
  const lbl = document.createElement('span');
  lbl.className = 'pop-x';
  lbl.textContent = `${t(p.dim === 0 ? 'dimOverworld' : 'dimNether')} · ${p.x}, ${p.z}`;
  const btn = document.createElement('button');
  btn.className = 'pop-tp'; btn.textContent = t('copyTp');
  wireCopyButton(btn, `/tp @s ${p.x} ~ ${p.z}`, () => t('copyTp'));
  row.append(lbl, btn);
  return row;
}
function showPortalPopup() {
  const plan = portalPlan(portal.dim, portal.x, portal.z);
  const pop = $('#popup');
  pop.textContent = '';
  pop.setAttribute('aria-label', t('portalTitle'));
  const close = document.createElement('button');
  close.className = 'pop-close'; close.textContent = '×'; close.title = t('close');
  close.onclick = hidePopup;
  const rule = document.createElement('p');
  rule.className = 'muted small pop-portal-rule';
  rule.textContent = t('portalRule', { r: plan.radius });
  const del = document.createElement('button');
  del.className = 'btn tiny portal-del'; del.textContent = t('portalRemove');
  del.onclick = () => { portal = null; hidePopup(); draw(); };
  pop.append(close, portalCoordRow(plan.src), portalCoordRow(plan.dest), rule, del);
  if (!pop.open) pop.show();   // non-modal: the map stays usable
}

function setRulerOn(on) {
  ruler.on = on; ruler.a = null; ruler.b = null; ruler.done = false;
  $('#rulerBtn').classList.toggle('on', on);
  canvas.style.cursor = on ? 'crosshair' : '';
  draw();
}

// overview minimap: same center, fixed zoom-out, viewport rectangle on top
function drawMinimap() {
  const mm = $('#minimap');
  const c = mm.getContext('2d');
  c.clearRect(0, 0, mm.width, mm.height);
  c.fillStyle = mapBg; c.fillRect(0, 0, mm.width, mm.height);
  if (minimapTile) {
    // the tile covers the zoomed-out view: map its world rect onto the
    // minimap canvas instead of blitting raw cells at 1:1 in the corner
    const bpp = view.bpp * minimapZoomOut(view.bpp);
    const px = (minimapTile.originX - view.cx) / bpp + mm.width / 2;
    const py = (minimapTile.originZ - view.cz) / bpp + mm.height / 2;
    c.imageSmoothingEnabled = false;
    c.drawImage(minimapTile.canvas, px, py,
      minimapTile.cols * minimapTile.scale / bpp, minimapTile.rows * minimapTile.scale / bpp);
  }
  const r = viewportRectOnMinimap(canvas.width / dpr, canvas.height / dpr, mm.width, mm.height, minimapZoomOut(view.bpp));
  c.strokeStyle = '#f2a73b'; c.lineWidth = 1.5;
  c.strokeRect(r.x, r.y, r.w, r.h);
}

function drawStructMarkers(g, color, points, W, H) {
  g.fillStyle = color; g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1;
  for (const [x, z] of points) {
    const { x: sx, y: sy } = worldToScreen(view, W, H, x, z);
    if (sx < -8 || sy < -8 || sx > W + 8 || sy > H + 8) continue;
    g.beginPath(); g.rect(sx - 3, sy - 3, 6, 6); g.fill(); g.stroke();
  }
}
// slime chunks render as chunk-sized overlay squares rather than fixed markers
function drawSlimeLayer(g, points, W, H) {
  const size = 16 / view.bpp;
  g.fillStyle = 'rgba(111,206,78,.4)'; g.strokeStyle = 'rgba(30,80,20,.7)'; g.lineWidth = 1;
  for (const [x, z] of points) {
    const { x: sx, y: sy } = worldToScreen(view, W, H, x, z);
    if (sx < -size || sy < -size || sx > W || sy > H) continue;
    g.beginPath(); g.rect(sx, sy, size, size); g.fill(); g.stroke();
  }
}

// favorites of the current world render as gold diamonds, always visible
function drawUserMarkers(W, H) {
  ctx.fillStyle = '#b17ee0'; ctx.strokeStyle = 'rgba(30,10,45,.75)'; ctx.lineWidth = 1.2;
  for (const m of markersFor(userMarkers, world)) {
    const sx = w2sx(m.x), sy = w2sy(m.z);
    if (sx < -8 || sy < -8 || sx > W + 8 || sy > H + 8) continue;
    ctx.beginPath();
    ctx.moveTo(sx - 5, sy - 5); ctx.lineTo(sx + 5, sy - 5); ctx.lineTo(sx + 5, sy + 5); ctx.lineTo(sx - 5, sy + 5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}
function drawFavMarkers(W, H) {
  ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = 'rgba(40,28,4,.75)'; ctx.lineWidth = 1.2;
  for (const f of favoritesFor(favorites, world)) {
    const sx = w2sx(f.x), sy = w2sy(f.z);
    if (sx < -8 || sy < -8 || sx > W + 8 || sy > H + 8) continue;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 5, sy); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx - 5, sy);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

function drawPin(sx, sy, active) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.bezierCurveTo(-9, -12, -7, -22, 0, -22);
  ctx.bezierCurveTo(7, -22, 9, -12, 0, 0);
  ctx.fillStyle = active ? '#ffd27a' : '#f2a73b';
  ctx.strokeStyle = '#1a1206'; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -15, 3.2, 0, 7); ctx.fillStyle = '#1a1206'; ctx.fill();
  ctx.restore();
}

let renderTimer = null;
let renderGen = 0;                    // tile batch generation (worker-side cancel)
const pendingTiles = new Map();       // in-flight tile keys -> generation they were requested with
let tileQueue = [];                   // tiles waiting to be sent, center-first
function requestRender(delay = 90) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    if (highlightBiome !== null) {
      // legend hover: the dimmed view stays a single viewport render
      renderReq = reqSeq++;
      send({
        type: 'render', reqId: renderReq, seed: world.seed, mc: world.mc, large: world.large, dim: world.dim,
        y: yLayer, highlight: highlightBiome,
        cx: view.cx, cz: view.cz, bpp: view.bpp,
        w: Math.ceil(canvas.width / dpr), h: Math.ceil(canvas.height / dpr)
      });
    } else {
      requestGridTiles();
    }
    requestMinimap();
    requestStructures();
    if (cmpState.on) requestCompareTiles();
  }, delay);
}
// progressive checkerboard: request every uncached tile of the view,
// center-first; bumping the generation cancels older off-screen requests
function requestGridTiles(bump = true) {
  // bump cancels the previous batch's off-screen tiles; a gap refill keeps
  // the current generation so in-flight view tiles are not re-cancelled
  if (bump) {
    renderGen++;
    send({ type: 'tileGen', gen: renderGen });
  }
  const W = Math.ceil(canvas.width / dpr), H = Math.ceil(canvas.height / dpr);
  const scale = renderScaleFor(view.bpp);
  const wk = tileWorldKey(world, yLayer, reliefOn());
  const cached = new Set(tileCache.entries().filter((e) => e.worldKey === wk).map((e) => e.key));
  const wanted = tilesForView(view, W, H, scale);
  // The engine scale caps at 256 blocks/cell, so a deep zoom-out needs many
  // more tiles than the default budget (~160 at max zoom on a 1920px canvas).
  // Grow the cache to hold the whole view plus a pan margin — otherwise every
  // fresh tile evicts one still on screen and the view can never fill up.
  tileCache.setMax(Math.max(TILE_GRID_CACHE_MAX, wanted.length + 16));
  // Rebuild the app-side queue from scratch: tiles of a previous view that
  // were never sent simply drop out, without flooding the worker. Only a
  // small window is in flight at any time, so the worker's FIFO stays short
  // and a view change never leaves it grinding through stale batches.
  tileQueue = [];
  for (const pos of wanted) {
    const key = tileKey(wk, scale, pos.originX, pos.originZ);
    if (cached.has(key)) { tileCache.touch(key); continue; }
    if (pendingTiles.has(key)) continue;   // already in flight
    tileQueue.push({
      type: 'renderTile', gen: renderGen, key, wk, scale, relief: reliefOn(),
      originX: pos.originX, originZ: pos.originZ,
      seed: world.seed, mc: world.mc, large: world.large, dim: world.dim, y: yLayer
    });
  }
  pumpTileQueue();
  refreshLegendFromView();
}
// flow control: keep at most a few renders in the worker's FIFO, sending the
// next (center-first) tile as acks arrive
const TILE_INFLIGHT_MAX = 4;
function pumpTileQueue() {
  while (pendingTiles.size < TILE_INFLIGHT_MAX && tileQueue.length) {
    const msg = tileQueue.shift();
    if (pendingTiles.has(msg.key)) continue;
    pendingTiles.set(msg.key, msg.gen);
    send(msg);
  }
}
// the stitched view's legend is the union of the visible tiles' biome sets
function refreshLegendFromView() {
  const W = canvas.width / dpr, H = canvas.height / dpr;
  const rect = { x0: s2wx(0), z0: s2wz(0), x1: s2wx(W), z1: s2wz(H) };
  buildLegend(unionPresent(tilesInView(tileCache.entries(), tileWorldKey(world, yLayer, reliefOn()), rect)));
}
// The minimap barely changes while panning: it re-renders on its own longer
// debounce so it never doubles the engine work of the main tile.
let minimapTimer = null;
function requestMinimap(delay = 400) {
  clearTimeout(minimapTimer);
  minimapTimer = setTimeout(() => {
    const mm = $('#minimap');
    minimapReq = reqSeq++;
    send({
      type: 'render', reqId: minimapReq, seed: world.seed, mc: world.mc, large: world.large, dim: world.dim,
      y: yLayer,
      highlight: null,
      cx: view.cx, cz: view.cz, bpp: view.bpp * minimapZoomOut(view.bpp),
      w: mm.width, h: mm.height
    });
  }, delay);
}
function requestStructures() {
  const types = structToggles.filter((tg) => tg.on).map((tg) => tg.type);
  if (!types.length) return;
  send(structuresRequestFor(reqSeq++, world, types, mainStructRect()));
  requestCompareStructures(types);
}
// query bounds of the main canvas, also used by the compare pane: both
// panes share the viewport, so the same rect (same budget) covers both
function mainStructRect() {
  return structQueryRect(view, canvas.width / dpr, canvas.height / dpr);
}

// ---------- pan / zoom ----------
// One pointer drags the map; two pointers pinch-zoom around their midpoint.
let dragging = false, lastX = 0, lastY = 0, moved = false;
const pointers = new Map();          // active pointerId -> {x, y}
let pinchDist = 0;                   // finger distance at the last pinch frame
function pinchState() {
  const [a, b] = [...pointers.values()];
  return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
}
canvas.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  // synthetic events (tests) carry no active pointer to capture
  try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  if (pointers.size === 2) { dragging = false; moved = true; pinchDist = pinchState().dist; }
  else if (pointers.size === 1) {
    if (sel.on) {
      const r = canvas.getBoundingClientRect();
      sel.a = { x: Math.round(s2wx(e.clientX - r.left)), z: Math.round(s2wz(e.clientY - r.top)) };
      sel.b = null; sel.done = false;
      $('#selBar').hidden = true;
      dragging = false; moved = true;   // a selection drag never pans or clicks
      return;
    }
    if (zoneTool.on) {
      const r = canvas.getBoundingClientRect();
      zoneTool.a = { x: Math.round(s2wx(e.clientX - r.left)), z: Math.round(s2wz(e.clientY - r.top)) };
      zoneTool.b = null;
      dragging = false; moved = true;   // a zone drag never pans or clicks
      return;
    }
    dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY;
  }
});
// HUD coordinate readout, in both referentials while the portal grid is on
function updateHudCoords(mx, my) {
  const hx = Math.round(s2wx(mx)), hz = Math.round(s2wz(my));
  const linked = showNetherGrid ? convertCoords(world.dim, hx, hz) : null;
  hud.querySelector('.coords').textContent =
    linked ? `${hx}, ${hz} ⇄ ${linked.label} ${linked.x}, ${linked.z}` : `${hx}, ${hz}`;
}
// live endpoint tracking for the drag-shaped tools (selection, ruler)
function trackToolPoint(mx, my) {
  if (sel.on && sel.a && !sel.done) {
    sel.b = { x: Math.round(s2wx(mx)), z: Math.round(s2wz(my)) };
    draw();
    return true;
  }
  if (zoneTool.on && zoneTool.a) {
    zoneTool.b = { x: Math.round(s2wx(mx)), z: Math.round(s2wz(my)) };
    draw();
    return true;
  }
  return false;
}
canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  updateHudCoords(mx, my);
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const p = pinchState();
    if (pinchDist > 0 && p.dist > 0) {
      // keep the world point under the fingers' midpoint fixed: this covers
      // both the zoom and the two-finger pan in one update
      const cx = p.mx - r.left, cy = p.my - r.top;
      const wx = s2wx(cx), wz = s2wz(cy);
      view.bpp = Math.min(512, Math.max(0.5, view.bpp * pinchDist / p.dist));
      view.cx = wx - (cx - canvas.width / (2 * dpr)) * view.bpp;
      view.cz = wz - (cy - canvas.height / (2 * dpr)) * view.bpp;
      draw();
    }
    pinchDist = p.dist;
    return;
  }
  if (trackToolPoint(mx, my)) return;
  if (dragging) {
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    view.cx -= dx * view.bpp; view.cz -= dy * view.bpp;
    lastX = e.clientX; lastY = e.clientY; draw();
  } else {
    if (ruler.on && ruler.a && !ruler.done) {
      ruler.b = { x: Math.round(s2wx(mx)), z: Math.round(s2wz(my)) };
      draw();
    }
    clearTimeout(probeTimer); probeTimer = setTimeout(() => probeBiome(mx, my), 120);
  }
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (sel.on && sel.a && sel.b && !sel.done && e.type === 'pointerup') {
    sel.done = true;
    showSelBar();
    return;
  }
  if (zoneTool.on && zoneTool.a && zoneTool.b && e.type === 'pointerup') {
    finishZoneDrag();
    return;
  }
  if (pointers.size < 2) pinchDist = 0;
  if (e.type === 'pointerup' && dragging && !moved) clickAt(e);
  dragging = false;
  if (!pointers.size) { requestRender(0); syncHash(); }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
let probeTimer = null;
function probeBiome(mx, my) {
  biomeProbeReq = reqSeq++;
  send({ type: 'biome', reqId: biomeProbeReq, seed: world.seed, mc: world.mc, large: world.large, dim: world.dim, y: yLayer, x: Math.round(s2wx(mx)), z: Math.round(s2wz(my)) });
}
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const wx = s2wx(mx), wz = s2wz(my);
  const factor = Math.exp(e.deltaY * 0.0012);
  view.bpp = Math.min(512, Math.max(0.5, view.bpp * factor));
  // keep cursor world point fixed
  view.cx = wx - (mx - canvas.width / (2 * dpr)) * view.bpp;
  view.cz = wz - (my - canvas.height / (2 * dpr)) * view.bpp;
  draw(); requestRender(); syncHash();
}, { passive: false });

// keyboard navigation: the canvas is focusable (tabindex=0); arrows pan,
// +/- zoom around the view center, Escape dismisses the pin popup
function zoomBy(factor) {
  view.bpp = Math.min(512, Math.max(0.5, view.bpp * factor));
  draw(); requestRender(); syncHash();
}
canvas.addEventListener('keydown', (e) => {
  const pan = 60 * view.bpp;   // ~60 screen pixels per keypress
  const moves = { ArrowLeft: [-pan, 0], ArrowRight: [pan, 0], ArrowUp: [0, -pan], ArrowDown: [0, pan] };
  if (moves[e.key]) {
    view.cx += moves[e.key][0]; view.cz += moves[e.key][1];
    draw(); requestRender(); syncHash();
  } else if (e.key === '+' || e.key === '=') { zoomBy(1 / 1.3); }
  else if (e.key === '-' || e.key === '_') { zoomBy(1.3); }
  else if (e.key === 'v' || e.key === 'V') { swapCompareVersion(); }
  else if (e.key === 'Escape') { dismissMapTools(); }
  else return;
  e.preventDefault();
});

// disarm every map tool and close the pin popup (Escape cascade)
function dismissMapTools() {
  if (ruler.on) setRulerOn(false);
  if (markerMode) setMarkerMode(false);
  if (portalMode) setPortalMode(false);
  if (sel.on) setSelOn(false);
  if (zoneTool.on) setZoneOn(false);
  hidePopup();
}

// ---------- side-by-side seed compare (#250) ----------
// A second map pane with its own seed and its own render worker (so a slow
// compare render never delays the main map), sharing the main viewport:
// pan/zoom on either canvas moves both, since both draw from `view`.
// The pure state/viewport logic lives in compare.js.
let cmpState = createCompareState();
let cmpWorker = null;                // dedicated engine worker, created on enter
let cmpGen = 0, cmpRefillTimer = null;
const cmpTileCache = createTileCache(TILE_GRID_CACHE_MAX);
const cmpPendingTiles = new Map();   // in-flight compare tile keys -> generation
let cmpTileQueue = [];
let cmpStructReq = 0;                // last structure listing sent to the compare worker
const cmpStructPoints = new Map();   // seed-B structure points: type -> [[x, z], ...]
const cmpCanvas = $('#cmpMap'), cmpCtx = cmpCanvas.getContext('2d');

function cmpWorld() { return compareWorldFor(world, cmpState.seed); }
function ensureCmpWorker() {
  if (cmpWorker) return;
  cmpWorker = new Worker('./worker.js', { type: 'module' });
  cmpWorker.engineReady = false;
  cmpWorker.pending = [];
  cmpWorker.onerror = (e) => { console.error('CMP WORKER ERROR:', e.message); sendErrorEvent('worker', e.message, e.filename, e.lineno); };
  cmpWorker.onmessage = (e) => {
    const d = e.data;
    if (d.type === 'fatal') { showFatal(d.message); return; }
    if (d.type === 'ready') { engineUp(cmpWorker); return; }
    if (d.type === 'gridTile') { onCmpGridTile(d); return; }
    if (d.type === 'structures') onCmpStructures(d);
  };
  if (altPalette) post(cmpWorker, { type: 'palette', alt: true });
}
// same skip/refill protocol as the main grid pipeline (onGridTile)
function onCmpGridTile(d) {
  if (d.skipped) {
    if (cmpPendingTiles.get(d.key) === d.gen) cmpPendingTiles.delete(d.key);
    pumpCmpTileQueue();
    clearTimeout(cmpRefillTimer);
    cmpRefillTimer = setTimeout(() => requestCompareTiles(false), 60);
    return;
  }
  cmpPendingTiles.delete(d.key);
  pumpCmpTileQueue();
  if (!d.ok) return;
  cmpTileCache.put({ ...tileCanvasOf(d), worldKey: d.wk, key: d.key, present: d.present });
  // tiles of a previous compare seed/world stay cached but are not drawn
  if (d.wk !== tileWorldKey(cmpWorld(), yLayer, reliefOn())) return;
  drawCompare();
}
function pumpCmpTileQueue() {
  while (cmpPendingTiles.size < TILE_INFLIGHT_MAX && cmpTileQueue.length) {
    const msg = cmpTileQueue.shift();
    if (cmpPendingTiles.has(msg.key)) continue;
    cmpPendingTiles.set(msg.key, msg.gen);
    post(cmpWorker, msg);
  }
}
// structure listing of the compare pane (#261): same protocol as the main
// map but computed for seed B on the dedicated worker; called by
// requestStructures (shared toggles) and when the compare seed changes
function requestCompareStructures(types = structToggles.filter((tg) => tg.on).map((tg) => tg.type)) {
  if (!cmpState.on || !types.length) return;
  cmpStructReq = reqSeq++;
  post(cmpWorker, structuresRequestFor(cmpStructReq, cmpWorld(), types, mainStructRect()));
}
function onCmpStructures(d) {
  if (d.reqId !== cmpStructReq) return;   // stale (older view or seed)
  for (const g of d.groups) cmpStructPoints.set(g.type, g.points);
  drawCompare();
}
// progressive checkerboard of the compare pane, center-first like the main map
function requestCompareTiles(bump = true) {
  if (!cmpState.on) return;
  if (bump) {
    cmpGen++;
    post(cmpWorker, { type: 'tileGen', gen: cmpGen });
  }
  const W = Math.ceil(cmpCanvas.width / dpr), H = Math.ceil(cmpCanvas.height / dpr);
  const scale = renderScaleFor(view.bpp);
  const wk = tileWorldKey(cmpWorld(), yLayer, reliefOn());
  const cached = new Set(cmpTileCache.entries().filter((e) => e.worldKey === wk).map((e) => e.key));
  const wanted = tilesForView(view, W, H, scale);
  cmpTileCache.setMax(Math.max(TILE_GRID_CACHE_MAX, wanted.length + 16));
  cmpTileQueue = [];
  for (const pos of wanted) {
    const key = tileKey(wk, scale, pos.originX, pos.originZ);
    if (cached.has(key)) { cmpTileCache.touch(key); continue; }
    if (cmpPendingTiles.has(key)) continue;
    cmpTileQueue.push({
      type: 'renderTile', gen: cmpGen, key, wk, scale, relief: reliefOn(),
      originX: pos.originX, originZ: pos.originZ,
      seed: cmpState.seed, mc: world.mc, large: world.large, dim: world.dim, y: yLayer
    });
  }
  pumpCmpTileQueue();
}
function drawCompare() {
  cmpCtx.save();
  cmpCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cmpCanvas.width / dpr, H = cmpCanvas.height / dpr;
  cmpCtx.clearRect(0, 0, W, H);
  cmpCtx.fillStyle = mapBg; cmpCtx.fillRect(0, 0, W, H);
  cmpCtx.imageSmoothingEnabled = false;
  const nw = screenToWorld(view, W, H, 0, 0), se = screenToWorld(view, W, H, W, H);
  const rect = { x0: nw.x, z0: nw.z, x1: se.x, z1: se.z };
  const scale = renderScaleFor(view.bpp);
  const cap = Math.max(TILE_PAINT_MAX, tilesForView(view, W, H, scale).length);
  for (const e of tilesInView(cmpTileCache.entries(), tileWorldKey(cmpWorld(), yLayer, reliefOn()), rect, cap, scale)) {
    cmpTileCache.touch(e.key);
    const p = worldToScreen(view, W, H, e.originX, e.originZ);
    cmpCtx.drawImage(e.canvas, p.x, p.y, e.cols * e.scale / view.bpp, e.rows * e.scale / view.bpp);
  }
  // active structure layers, computed for seed B (the shared toggles apply
  // to both panes); personal overlays (pins, favorites, markers, zones) are
  // tied to seed A and stay on the main map only
  drawStructLayers(cmpCtx, W, H, (tg) => cmpStructPoints.get(tg.type));
  // center crosshair mirrors the main map: the shared center stays visible
  cmpCtx.strokeStyle = curTheme === 'light' ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.25)';
  cmpCtx.lineWidth = 1;
  cmpCtx.beginPath(); cmpCtx.moveTo(W / 2 - 7, H / 2); cmpCtx.lineTo(W / 2 + 7, H / 2);
  cmpCtx.moveTo(W / 2, H / 2 - 7); cmpCtx.lineTo(W / 2, H / 2 + 7); cmpCtx.stroke();
  cmpCtx.restore();
}
// enter/leave compare mode; leaving stops the dedicated worker and frees
// its tiles so nothing keeps rendering behind the single-map view
function setCompareMode(on, seed) {
  cmpState = on ? enterCompare(cmpState, seed ?? $('#cmpSeed').value, world.seed) : exitCompare(cmpState);
  document.querySelector('.mapwrap').classList.toggle('comparing', on);
  $('#cmpPane').hidden = !on;
  const btn = $('#cmpBtn');
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-pressed', String(on));
  if (on) {
    $('#cmpSeed').value = cmpState.seed;
    ensureCmpWorker();
  } else if (cmpWorker) {
    cmpWorker.terminate();
    cmpWorker = null;
    cmpTileCache.clear(); cmpPendingTiles.clear(); cmpTileQueue = [];
    cmpStructPoints.clear();
    clearTimeout(cmpRefillTimer);
  }
  resize();   // the map halves changed size; redraws and re-requests both panes
}
// the compare seed field re-targets the pane (empty falls back to the main seed)
function applyCompareSeed() {
  cmpState = enterCompare(cmpState, $('#cmpSeed').value, world.seed);
  $('#cmpSeed').value = cmpState.seed;
  cmpStructPoints.clear();   // points of the previous compare seed
  drawCompare();
  requestCompareTiles();
  requestCompareStructures();
}
// pan/zoom on the compare canvas drives the shared viewport, so the main
// map follows (draw() repaints both panes; requestRender() refills both)
let cmpDragging = false, cmpLastX = 0, cmpLastY = 0;
cmpCanvas.addEventListener('pointerdown', (e) => {
  try { cmpCanvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  cmpDragging = true; cmpLastX = e.clientX; cmpLastY = e.clientY;
});
cmpCanvas.addEventListener('pointermove', (e) => {
  if (!cmpDragging) return;
  Object.assign(view, panViewport(view, e.clientX - cmpLastX, e.clientY - cmpLastY));
  cmpLastX = e.clientX; cmpLastY = e.clientY;
  draw();
});
function endCmpPointer() {
  if (!cmpDragging) return;
  cmpDragging = false;
  requestRender(0); syncHash();
}
cmpCanvas.addEventListener('pointerup', endCmpPointer);
cmpCanvas.addEventListener('pointercancel', endCmpPointer);
cmpCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = cmpCanvas.getBoundingClientRect();
  Object.assign(view, zoomViewportAt(view, cmpCanvas.width / dpr, cmpCanvas.height / dpr,
    e.clientX - r.left, e.clientY - r.top, Math.exp(e.deltaY * 0.0012)));
  draw(); requestRender(); syncHash();
}, { passive: false });

function clickAt(e) {
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  if (markerMode) {
    setUserMarkers(addMarker(userMarkers, {
      ...world, x: Math.round(s2wx(mx)), z: Math.round(s2wz(my))
    }));
    return;
  }
  if (portalMode) {
    placePortal(Math.round(s2wx(mx)), Math.round(s2wz(my)));
    return;
  }
  if (ruler.on) {
    const p = { x: Math.round(s2wx(mx)), z: Math.round(s2wz(my)) };
    if (!ruler.a || ruler.done) { ruler.a = p; ruler.b = null; ruler.done = false; }
    else { ruler.b = p; ruler.done = true; }
    draw(); return;
  }
  // hit-test pins
  for (let i = 0; i < pins.length; i++) {
    if (Math.hypot(mx - w2sx(pins[i].x), my - w2sy(pins[i].z) + 11) < 14) { selectPin(i); return; }
  }
  // hit-test the portal pins: clicking one re-opens the portal popup
  if (portal && portalPinAt(mx, my)) { showPortalPopup(); return; }
  // hit-test zones (under the pins: a pin inside a zone stays clickable)
  const zHit = zoneAt(mx, my);
  if (zHit) { showZoneEditor(zHit.zone); return; }
  // clicked empty map: deselect and dismiss the popup
  hidePopup();
}

// ---------- criteria rows ----------
const MAX_CRIT_ROWS = 8;
let biomesSorted = [];

function critSelect(entries, initial) {
  const sel = document.createElement('select');
  for (const [value, label, i18nKey] of entries) {
    const o = document.createElement('option');
    o.value = value; o.textContent = label;
    if (i18nKey) o.dataset.i18n = i18nKey;   // retranslated by applyI18n
    sel.appendChild(o);
  }
  if (initial !== undefined) sel.value = String(initial);
  if (sel.selectedIndex < 0) sel.selectedIndex = 0;
  return sel;
}
function biomesOfDim() {
  return biomesSorted.filter((b) => (b.dim || 0) === world.dim);
}
function biomeSelect(initial) {
  const sel = document.createElement('select');
  const entries = biomesOfDim()
    .map((b) => ({ id: b.id, name: b.name, label: biomeLabel(b.name) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  for (const e of entries) {
    const o = document.createElement('option');
    o.value = e.id; o.textContent = e.label; o.dataset.biome = e.name;
    sel.appendChild(o);
  }
  if (initial !== undefined) sel.value = String(initial);
  if (sel.selectedIndex < 0) sel.selectedIndex = 0;
  return sel;
}
// sentinel value of the "any biome" option in the main-biome selector: the
// spot's own biome is not constrained (structures-only searches, #227)
const ANY_BIOME = -1;
// the main-biome selector is a regular biome select plus the "any" option
function mainBiomeSelect(initial) {
  const sel = biomeSelect();
  const o = document.createElement('option');
  o.value = String(ANY_BIOME); o.dataset.i18n = 'anyBiome'; o.textContent = t('anyBiome');
  sel.insertBefore(o, sel.firstChild);
  sel.value = initial === undefined ? String(ANY_BIOME) : String(initial);
  if (sel.selectedIndex < 0) sel.selectedIndex = 0;
  return sel;
}
function structsOfDim() {
  return structToggles.filter((tg) => (tg.dim || 0) === world.dim);
}
function structSelect(initial) {
  return critSelect(structsOfDim().map((tg) => [tg.type, t(tg.labelKey), tg.labelKey]), initial);
}
function numInput(value, min, step, cls) {
  const inp = document.createElement('input');
  inp.type = 'number'; inp.min = min; inp.step = step; inp.value = value;
  inp.className = 'num' + (cls ? ' ' + cls : '');
  return inp;
}
// dynamically built controls carry an i18n-tracked aria-label so screen
// readers get a name (there is no room for a visible one in a criteria row)
function aria(el, key) {
  el.dataset.i18nAria = key;
  el.setAttribute('aria-label', t(key));
  return el;
}
function subLbl(key) {
  const s = document.createElement('span');
  s.className = 'sub-lbl'; s.dataset.i18n = key; s.textContent = t(key);
  return s;
}
function addRow(container, parts) {
  if (container.children.length >= MAX_CRIT_ROWS) return;
  const row = document.createElement('div'); row.className = 'row';
  parts.forEach((el) => row.appendChild(el));
  const rm = document.createElement('button');
  rm.className = 'rm'; rm.textContent = '×';
  rm.dataset.i18nTitle = 'remove'; rm.title = t('remove');
  rm.onclick = () => row.remove();
  row.appendChild(rm);
  container.appendChild(row);
  // optional sections are collapsed by default (#269): any clause added here
  // (by hand, permalink, preset, history or import) reveals its section
  const sec = container.closest('details.critsec');
  if (sec) sec.open = true;
}
// Collapse the optional criteria sections back down (#269); the addRow calls
// that follow a clear re-open exactly the sections that receive clauses.
function collapseCritSections() {
  document.querySelectorAll('#criteriaCard details.critsec').forEach((d) => { d.open = false; });
}
function addMainBiomeRow(biome) {
  addRow($('#mainBiomes'), [aria(mainBiomeSelect(biome), 'ariaBiome')]);
}
function addAdjRow(biome, dist, negate, yl) {
  const neg = critSelect([['0', t('present'), 'present'], ['1', t('absent'), 'absent']], negate ? '1' : '0');
  neg.className = 'neg';
  aria(neg, 'ariaPresence');
  // optional per-clause altitude: empty = same layer as the map/search Y
  const yInp = numInput(yl ?? '', -64, 1, 'sm yopt');
  yInp.max = 320; yInp.placeholder = 'Y';
  addRow($('#adjClauses'), [aria(biomeSelect(biome), 'ariaBiome'), neg, subLbl('within'), aria(numInput(dist ?? 400, 0, 16), 'ariaDistance'), subLbl('blocks'), subLbl('atY'), aria(yInp, 'ariaClauseY')]);
}
// geographic pattern: island / lagoon, or "biome A enclosed by biome B"
function addShapeRow(kind, a, b, mx) {
  const kindSel = critSelect([
    ['island', t('shapeIsland'), 'shapeIsland'],
    ['lagoon', t('shapeLagoon'), 'shapeLagoon'],
    ['enclave', t('shapeEnclave'), 'shapeEnclave']
  ], kind || 'island');
  kindSel.className = 'shapekind';
  aria(kindSel, 'ariaShapeKind');
  const selA = aria(biomeSelect(a), 'ariaBiome');
  const selB = aria(biomeSelect(b), 'ariaBiome');
  // the biome pair only means something for an enclave
  const sync = () => {
    const en = kindSel.value === 'enclave';
    selA.disabled = !en; selB.disabled = !en;
  };
  kindSel.addEventListener('change', sync);
  addRow($('#shapeClauses'), [
    kindSel, selA, subLbl('shapeIn'), selB,
    subLbl('maxSize'), aria(numInput(mx ?? 1000, 16, 16, 'sm'), 'ariaShapeMax'), subLbl('blocks')
  ]);
  sync();
}
// "at least pct% of biome B within dist blocks of the spot"
function addPctRow(biome, pct, dist) {
  addRow($('#pctClauses'), [
    aria(biomeSelect(biome), 'ariaBiome'),
    subLbl('atLeast'), aria(numInput(pct ?? 30, 0, 1, 'sm'), 'ariaPercent'),
    subLbl('pctWithin'), aria(numInput(dist ?? 400, 0, 16), 'ariaDistance'), subLbl('blocks')
  ]);
}
function addStructRow(type, min, radius, inMain) {
  const im = document.createElement('input');
  im.type = 'checkbox'; im.className = 'inmain'; im.checked = !!inMain;
  aria(im, 'inMainBiome');
  const imLbl = document.createElement('label');
  imLbl.className = 'sub-lbl inmain-lbl';
  imLbl.append(im, subLbl('inMainBiome'));
  addRow($('#structClauses'), [aria(structSelect(type), 'ariaStructType'), subLbl('atLeast'), aria(numInput(min ?? 1, 0, 1, 'sm'), 'ariaMinCount'), subLbl('within'), aria(numInput(radius ?? 800, 0, 50), 'ariaRadius'), subLbl('blocks'), imLbl]);
}
// "a T1 and a T2 within `gap` blocks of each other, within `radius` of the spot"
function addPairRow(t1, t2, gap, radius) {
  addRow($('#pairClauses'), [
    aria(structSelect(t1), 'ariaStructType'), aria(structSelect(t2), 'ariaStructType'),
    subLbl('within'), aria(numInput(gap ?? 300, 0, 50, 'sm'), 'ariaDistance'), subLbl('ofEachOther'),
    subLbl('within'), aria(numInput(radius ?? 800, 0, 50), 'ariaRadius'), subLbl('blocks')
  ]);
}
function rowsOf(sel) { return [...$(sel).querySelectorAll('.row')]; }

// ---------- search ----------
// Criteria panel -> search-message fields, or null when the criteria cannot
// anchor a search (no main biome and no structure criterion).
// Shared by the location search and the multi-seed search.
// "Any biome" (or no main-biome row at all) is sent as an empty mainBiomes
// list: the engine then skips the biome pass and requires structure clauses.
function collectCriteria() {
  const pickedBiomes = rowsOf('#mainBiomes')
    .map((r) => Number.parseInt(r.querySelector('select').value, 10))
    .filter(Number.isFinite);
  const mainBiomes = pickedBiomes.includes(ANY_BIOME) ? [] : pickedBiomes;
  const adjClauses = rowsOf('#adjClauses').map((r) => {
    const ins = r.querySelectorAll('input.num');
    const y = Number.parseInt(ins[1].value, 10);
    return {
      biomes: [Number.parseInt(r.querySelector('select').value, 10)],
      dist: Number.parseInt(ins[0].value, 10) || 0,
      negate: r.querySelector('select.neg').value === '1',
      ...(Number.isFinite(y) ? { y } : {})
    };
  }).filter((c) => Number.isFinite(c.biomes[0]) && c.dist > 0);
  const pctClauses = rowsOf('#pctClauses').map((r) => {
    const ins = r.querySelectorAll('input.num');
    return {
      biomes: [Number.parseInt(r.querySelector('select').value, 10)],
      pct: Number.parseInt(ins[0].value, 10) || 0,
      dist: Number.parseInt(ins[1].value, 10) || 0
    };
  }).filter((c) => Number.isFinite(c.biomes[0]) && c.pct >= 1 && c.pct <= 100 && c.dist > 0);
  const shapeClauses = rowsOf('#shapeClauses').map((r) => {
    const sels = r.querySelectorAll('select');
    const kind = sels[0].value;
    const max = Number.parseInt(r.querySelector('input.num').value, 10) || 0;
    const a = Number.parseInt(sels[1].value, 10), b = Number.parseInt(sels[2].value, 10);
    return { kind, max, ...(kind === 'enclave' ? { a: [a], b: [b] } : {}) };
  }).filter((c) => c.max > 0 && (c.kind !== 'enclave' || (Number.isFinite(c.a[0]) && Number.isFinite(c.b[0]))));
  const structClauses = rowsOf('#structClauses').map((r) => {
    const ins = r.querySelectorAll('input.num');
    return {
      type: Number.parseInt(r.querySelector('select').value, 10),
      min: Number.parseInt(ins[0].value, 10) || 0,
      radius: Number.parseInt(ins[1].value, 10) || 0,
      inMain: r.querySelector('input.inmain').checked
    };
  }).filter((c) => Number.isFinite(c.type) && c.min > 0 && c.radius > 0);
  const pairClauses = rowsOf('#pairClauses').map((r) => {
    const sels = r.querySelectorAll('select');
    const ins = r.querySelectorAll('input.num');
    return {
      t1: Number.parseInt(sels[0].value, 10), t2: Number.parseInt(sels[1].value, 10),
      gap: Number.parseInt(ins[0].value, 10) || 0,
      radius: Number.parseInt(ins[1].value, 10) || 0
    };
  }).filter((c) => Number.isFinite(c.t1) && Number.isFinite(c.t2) && c.gap > 0 && c.radius > 0);
  const intOrNull = (sel) => {
    const v = $(sel).value.trim();
    const n = Number.parseInt(v, 10);
    return v !== '' && Number.isFinite(n) ? n : null;
  };
  const surfMin = intOrNull('#surfMin'), surfMax = intOrNull('#surfMax');
  // without a main biome the search must be anchored by structure criteria
  if (!mainBiomes.length && !structClauses.length && !pairClauses.length) return null;
  return {
    mainBiomes,
    adjMode: $('#adjMode').value, adjClauses,
    pctMode: $('#pctMode').value, pctClauses,
    shapeMode: $('#shapeMode').value, shapeClauses,
    structMode: $('#structMode').value, structClauses, pairClauses,
    surface: surfMin !== null || surfMax !== null ? { min: surfMin, max: surfMax } : null
  };
}

function runSearch() {
  const crit = collectCriteria();
  if (!crit) {
    searchInfo.textContent = t('pickCriteria');
    searchInfo.className = 'info err';
    return;
  }
  const range = Number.parseInt($('#range').value, 10) || 4000;
  const step = Number.parseInt($('#step').value, 10) || 48;
  searchInfo.textContent = t('searching'); searchInfo.className = 'info busy';
  pushSearchHistory();
  searchReq = reqSeq;
  setSearchBusy(true);
  sendSearch({
    type: 'search', reqId: reqSeq++, seed: world.seed, mc: world.mc, large: world.large, dim: world.dim,
    y: yLayer,
    ...crit,
    cx: Math.round(view.cx), cz: Math.round(view.cz), range, step, mergeDist: Math.max(256, step * 6)
  });
}

// ---------- nearest rare biome (#252) ----------
// One button per rare biome: the worker scans growing rings around the view
// center and reports the closest occurrence, with the same progress/cancel
// pattern as the cancellable search (#20). The active button flips to Cancel.
let rareReq = 0, rareBusy = false, rareBtn = null;
function setRareBusy(on, btn) {
  rareBusy = on;
  const prog = $('#rareProgress');
  prog.hidden = !on;
  prog.value = 0;
  if (on) {
    rareBtn = btn;
    btn.textContent = t('cancelBtn');
  } else if (rareBtn) {
    rareBtn.textContent = biomeLabel(rareBtn.dataset.biome);
    rareBtn = null;
  }
}
function startRareSearch(biome, btn) {
  if (rareBusy) { sendSearch({ type: 'cancelRare', reqId: rareReq }); return; }
  rarePin = null;
  const info = $('#rareInfo');
  info.textContent = t('searching'); info.className = 'info busy';
  rareReq = reqSeq++;
  setRareBusy(true, btn);
  sendSearch({
    type: 'rareBiome', reqId: rareReq, seed: world.seed, mc: world.mc, large: world.large, dim: world.dim,
    y: yLayer, cx: Math.round(view.cx), cz: Math.round(view.cz), biome
  });
}
function onRareResult(d) {
  if (d.reqId !== rareReq) return;   // stale
  setRareBusy(false);
  const info = $('#rareInfo');
  if (d.error === 'cancelled') {
    info.textContent = t('searchCancelled'); info.className = 'info empty';
    return;
  }
  if (d.error) {
    info.textContent = t('searchFailedArea'); info.className = 'info err';
    return;
  }
  if (!d.hit) {
    info.textContent = t('rareNotFound', { r: RARE_MAX_RADIUS }); info.className = 'info empty';
    return;
  }
  rarePin = d.hit;
  view.cx = d.hit.x; view.cz = d.hit.z;
  if (view.bpp > 4) view.bpp = 3;
  info.textContent = t('rareFound', { x: d.hit.x, z: d.hit.z, ms: d.ms }); info.className = 'info ok';
  draw(); requestRender(0); syncHash(); showPopup(d.hit);
}
// the biome names are the engine's technical names: data-biome makes
// applyI18n retranslate the labels on a language switch, like the dropdowns
function buildRareBiomeUI() {
  const box = $('#rareList');
  for (const b of RARE_BIOMES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn tiny';
    btn.dataset.biome = b.name;
    btn.textContent = biomeLabel(b.name);
    btn.onclick = () => startRareSearch(b.id, btn);
    box.appendChild(btn);
  }
}

// ---------- multi-seed search (worker pool) ----------
const seedPool = [];
let seedReq = 0, seedBusy = false;
let seedBatches = [], seedFoundCount = 0, seedScannedCount = 0, seedTotal = 0;
let seedCandidates = [];   // sorted by score (more places, then closest)
let seedMsgBase = null, seedStart = '0', seedMode = 'random';

function getSeedPool() {
  const target = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  while (seedPool.length < target) {
    const w = new Worker('./worker.js', { type: 'module' });
    w.engineReady = false; w.pending = []; w.idle = true;
    w.onerror = (e) => console.error('SEED WORKER ERROR:', e.message);
    w.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'ready') { engineUp(w); return; }
      if (d.type === 'seedScanned') onSeedScanned(d);
      else if (d.type === 'seedBatchDone') onSeedBatchDone(w, d);
    };
    seedPool.push(w);
  }
  return seedPool;
}
function setSeedBusy(on) {
  seedBusy = on;
  const btn = $('#seedSearchBtn');
  btn.dataset.i18n = on ? 'cancelBtn' : 'seedSearchBtn';
  btn.textContent = t(btn.dataset.i18n);
  const prog = $('#seedProgress');
  prog.hidden = !on;
  prog.value = 0;
  updateSeedResumeBtn();
}
// ---- resumable run: the queue state survives a cancel or a page reload ----
let seedRunMeta = null;   // static fields of the running search, or null
function savedSeedRun() {
  try { return parseSeedRun(localStorage.getItem('seedRun')); } catch { return null; }
}
function saveSeedRun() {
  if (!seedRunMeta) return;
  const inflight = seedPool.filter((w) => w.batch).map((w) => w.batch);
  const batches = [...inflight, ...seedBatches];
  if (!batches.length) return;
  const run = { ...seedRunMeta, scanned: seedScannedCount, batches, candidates: seedCandidates };
  try { localStorage.setItem('seedRun', serializeSeedRun(run)); } catch { /* ignore */ }
}
function clearSeedRun() {
  seedRunMeta = null;
  try { localStorage.removeItem('seedRun'); } catch { /* ignore */ }
}
function updateSeedResumeBtn() {
  const b = $('#seedResumeBtn');
  const run = seedBusy ? null : savedSeedRun();
  b.hidden = !run;
  if (run) b.textContent = t('seedResume', { n: run.scanned, t: run.total });
}
function startSeedSearch() {
  const crit = collectCriteria();
  const seedInfo = $('#seedInfo');
  if (!crit) {
    seedInfo.textContent = t('pickCriteria');
    seedInfo.className = 'info err';
    return;
  }
  seedTotal = Math.min(SEED_SEARCH_MAX_TOTAL, Math.max(1, Number.parseInt($('#seedCount').value, 10) || 500));
  const radius = Math.min(5000, Math.max(500, Number.parseInt($('#seedRadius').value, 10) || 1500));
  // seeds are only probed: a coarse stride keeps the per-seed cost low
  const step = Math.max(32, Number.parseInt($('#step').value, 10) || 32);
  seedReq = reqSeq++;
  seedFoundCount = 0; seedScannedCount = 0; seedCandidates = [];
  seedBatches = planBatches(seedTotal, 8);
  seedStart = $('#seed').value || '0';
  seedMode = $('#seedMode').value;
  seedMsgBase = {
    type: 'seedSearch', reqId: seedReq, mc: world.mc, large: world.large, dim: world.dim,
    y: yLayer, range: radius, step, ...crit
  };
  seedRunMeta = {
    v: 1, mode: seedMode, start: seedStart, total: seedTotal, radius, step,
    mc: world.mc, large: world.large, dim: world.dim, y: yLayer, crit: readCriteria()
  };
  saveSeedRun();
  $('#seedResults').textContent = '';
  seedInfo.textContent = t('searching'); seedInfo.className = 'info busy';
  setSeedBusy(true);
  getSeedPool().forEach(dispatchSeedBatch);
}
function dispatchSeedBatch(w) {
  const b = seedBatches.shift();
  if (!b) {
    w.batch = null; w.idle = true;
    finishSeedSearchIfIdle();
    return;
  }
  w.batch = b; w.idle = false;
  const seeds = seedMode === 'seq'
    ? sequentialSeeds(seedStart, b.offset, b.count)
    : randomSeeds(b.count, Math.random);
  post(w, { ...seedMsgBase, seeds });
}
function onSeedScanned(d) {
  if (d.reqId !== seedReq) return;
  seedScannedCount++;
  $('#seedProgress').value = Math.round(100 * seedScannedCount / seedTotal);
  if (d.hit && seedFoundCount < SEED_SEARCH_MAX_FOUND) {
    seedFoundCount++;
    seedCandidates = insertCandidate(seedCandidates,
      { seed: d.seed, hit: d.hit, count: d.count || 1, dist: originDist(d.hit) });
    renderSeedResults();
    if (seedFoundCount >= SEED_SEARCH_MAX_FOUND) { cancelSeedSearch(); clearSeedRun(); }
  }
}
function onSeedBatchDone(w, d) {
  if (d.reqId !== seedReq) return;
  w.batch = null;
  if (d.error) { seedBatches = []; clearSeedRun(); }
  else saveSeedRun();   // checkpoint: this batch is done for good
  dispatchSeedBatch(w);
}
function finishSeedSearchIfIdle() {
  if (!seedBusy || !seedPool.every((w) => w.idle)) return;
  setSeedBusy(false);
  if (seedRunMeta) clearSeedRun();   // ran to completion: nothing to resume
  updateSeedResumeBtn();
  const seedInfo = $('#seedInfo');
  if (seedFoundCount) {
    seedInfo.textContent = t('seedDone', { f: seedFoundCount, n: seedScannedCount });
    seedInfo.className = 'info ok';
  } else {
    seedInfo.textContent = t('seedNone', { n: seedScannedCount });
    seedInfo.className = 'info empty';
  }
}
function cancelSeedSearch() {
  // in-flight batches are lost mid-scan: put them back before the snapshot
  for (const w of seedPool) {
    if (w.batch) { seedBatches.unshift(w.batch); w.batch = null; }
  }
  saveSeedRun();
  seedRunMeta = null;   // the snapshot is final until a resume/restart
  seedBatches = [];
  for (const w of seedPool) post(w, { type: 'cancelSeedSearch', reqId: seedReq });
}
// Resume an interrupted run: restore its world/criteria, requeue what was
// left and keep the candidates found so far (re-scanned seeds dedup).
function resumeSeedSearch() {
  const run = savedSeedRun();
  if (!run || seedBusy) return;
  world.mc = run.mc; $('#mcver').value = String(run.mc);
  world.large = run.large; $('#large').checked = run.large;
  if (world.dim !== run.dim) { setDimension(run.dim); $('#dimSel').value = String(run.dim); }
  applyCriteria(run.crit);
  const crit = collectCriteria();
  if (!crit) { clearSeedRun(); updateSeedResumeBtn(); return; }
  seedTotal = run.total;
  seedReq = reqSeq++;
  seedFoundCount = run.candidates.length; seedScannedCount = run.scanned;
  seedCandidates = run.candidates;
  seedBatches = run.batches.slice();
  seedStart = run.start; seedMode = run.mode;
  $('#seedMode').value = run.mode;
  $('#seedCount').value = String(run.total);
  $('#seedRadius').value = String(run.radius);
  seedRunMeta = {
    v: 1, mode: run.mode, start: run.start, total: run.total, radius: run.radius,
    step: run.step, mc: run.mc, large: run.large, dim: run.dim, y: run.y, crit: run.crit
  };
  seedMsgBase = {
    type: 'seedSearch', reqId: seedReq, mc: run.mc, large: run.large, dim: run.dim,
    y: run.y, range: run.radius, step: run.step, ...crit
  };
  updateSeedResumeBtn();
  renderSeedResults();
  $('#seedProgress').value = Math.round(100 * seedScannedCount / seedTotal);
  const seedInfo = $('#seedInfo');
  seedInfo.textContent = t('searching'); seedInfo.className = 'info busy';
  setSeedBusy(true);
  getSeedPool().forEach(dispatchSeedBatch);
}
// clicking a candidate loads the seed and centers the map on its first hit
function renderSeedResults() {
  const box = $('#seedResults');
  box.textContent = '';
  for (const c of seedCandidates) box.appendChild(seedResultRow(c));
}
function seedResultRow(cand) {
  const li = document.createElement('button');
  li.className = 'result';
  const rx = document.createElement('span');
  rx.className = 'rx'; rx.textContent = cand.seed;
  const rc = document.createElement('span');
  rc.className = 'rc';
  rc.textContent = `${cand.count} ⚑ · ${cand.dist} ${t('blocks')}`;
  rc.title = `${cand.hit.x}, ${cand.hit.z}`;
  li.append(rx, rc);
  li.onclick = () => {
    $('#seed').value = cand.seed;
    world.seed = cand.seed;
    view.cx = cand.hit.x; view.cz = cand.hit.z;
    curReset(); draw(); requestRender(0); syncHash();
  };
  // side-by-side shortcut: open the compare pane on this candidate (#250)
  const cmp = document.createElement('button');
  cmp.className = 'btn tiny seedcmp';
  cmp.textContent = '⇆';
  cmp.title = t('compareSeedResult'); cmp.dataset.i18nTitle = 'compareSeedResult';
  cmp.setAttribute('aria-label', t('compareSeedResult')); cmp.dataset.i18nAria = 'compareSeedResult';
  cmp.onclick = () => setCompareMode(true, cand.seed);
  const row = document.createElement('div');
  row.className = 'seedrow';
  row.append(li, cmp);
  return row;
}
function onSearchResult(d) {
  if (d.reqId !== searchReq) return;   // stale
  setSearchBusy(false);
  basePins = d.hits; lastSpawn = d.spawn || null; selected = -1;
  applySort();
  hidePopup();
  resultsEl.textContent = '';
  $('#exportBtns').hidden = !pins.length;
  $('#sortCtl').hidden = !pins.length;
  if (d.error === 'cancelled') {
    searchInfo.textContent = t('searchCancelled');
    searchInfo.className = 'info empty';
    draw(); return;
  }
  if (d.error) {
    searchInfo.textContent = t('searchFailedArea');
    searchInfo.className = 'info err';
    draw(); return;
  }
  if (!pins.length) {
    searchInfo.textContent = t('noMatch', { r: $('#range').value, ms: d.ms });
    searchInfo.className = 'info empty';
    draw(); return;
  }
  searchInfo.textContent = pins.length > 1 ? t('foundMany', { n: pins.length, ms: d.ms }) : t('foundOne', { ms: d.ms });
  searchInfo.className = 'info ok';
  renderResultsList();
  // #268: the list lives well below #searchInfo in the panel; bring it into
  // view after a user-launched search (scroll only, never steal focus)
  resultsEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  selectPin(0);
}
// displayed order: as searched, or closest-to-spawn first (Overworld only)
function applySort() {
  const spawnable = sortMode === 'spawn' && lastSpawn;
  pins = spawnable ? sortHitsByDist(basePins, lastSpawn) : basePins;
  const sel = $('#sortSel');
  if (sel) {
    sel.querySelector('option[value="spawn"]').disabled = !lastSpawn;
    if (!lastSpawn && sortMode === 'spawn') { sortMode = 'order'; sel.value = 'order'; }
  }
}
function renderResultsList() {
  resultsEl.textContent = '';
  pins.forEach((p, i) => {
    const li = document.createElement('button');
    li.className = 'result'; li.dataset.i = i;
    const rx = document.createElement('span');
    rx.className = 'rx'; rx.textContent = `${p.x}, ${p.z}`;
    li.appendChild(rx);
    if (p.count) {
      const rc = document.createElement('span');
      rc.className = 'rc'; rc.textContent = t('nearby', { n: p.count });
      li.appendChild(rc);
    }
    li.onclick = () => selectPin(i);
    resultsEl.appendChild(li);
  });
}
// load pins from a CSV file (the mirror of the CSV export)
function importLocationsCSV(file) {
  file.text().then((text) => {
    const { hits } = parseLocationsCSV(text);
    if (!hits.length) {
      searchInfo.textContent = t('importEmpty');
      searchInfo.className = 'info err';
      return;
    }
    basePins = hits; selected = -1;
    applySort();
    hidePopup();
    renderResultsList();
    $('#exportBtns').hidden = false;
    $('#sortCtl').hidden = false;
    searchInfo.textContent = t('imported', { n: hits.length });
    searchInfo.className = 'info ok';
    selectPin(0);
  }).catch(() => {
    searchInfo.textContent = t('importEmpty');
    searchInfo.className = 'info err';
  });
}
function selectPin(i) {
  selected = i;
  const p = pins[i]; if (!p) return;
  view.cx = p.x; view.cz = p.z;
  if (view.bpp > 4) view.bpp = 3;
  [...resultsEl.children].forEach((c) => c.classList.toggle('sel', +c.dataset.i === i));
  draw(); requestRender(0); syncHash(); showPopup(p);
}
// copy `text` on click, flashing a Copied / Copy failed feedback on the button
function wireCopyButton(btn, text, idleLabel) {
  btn.onclick = () => {
    copyText(text)
      .then(() => { btn.textContent = t('copied'); })
      .catch(() => { btn.textContent = t('copyFailed'); });
    setTimeout(() => { btn.textContent = idleLabel(); }, 1200);
  };
}
function showPopup(p) {
  const pop = $('#popup');
  pop.textContent = '';
  pop.setAttribute('aria-label', `${p.x}, ${p.z}`);
  const xEl = document.createElement('div');
  xEl.className = 'pop-x'; xEl.textContent = `${p.x}, ${p.z}`;
  const btn = document.createElement('button');
  btn.className = 'pop-tp'; btn.textContent = t('copyTp');
  wireCopyButton(btn, `/tp @s ${p.x} ~ ${p.z}`, () => t('copyTp'));
  const close = document.createElement('button');
  close.className = 'pop-close'; close.textContent = '×';
  close.title = t('close');
  close.onclick = hidePopup;
  pop.append(close, xEl, btn, favStarButton(p));
  // equivalent coordinates in the linked dimension (÷8 / ×8); none for the End
  const conv = convertCoords(world.dim, p.x, p.z);
  if (conv) {
    const label = `${conv.label} ≈ ${conv.x}, ${conv.z}`;
    const row = document.createElement('button');
    row.className = 'pop-conv';
    row.textContent = label;
    row.title = t('copyConverted');
    wireCopyButton(row, `${conv.x} ~ ${conv.z}`, () => label);
    pop.append(row);
  }
  if (!pop.open) pop.show();   // non-modal: the map stays usable
}
// ---------- favorites ----------
let searchHistory = parseHistory((() => {
  try { return localStorage.getItem('searchHistory'); } catch { return null; }
})());
function pushSearchHistory() {
  searchHistory = addHistoryEntry(searchHistory, {
    seed: String(world.seed), mc: world.mc, large: world.large, dim: world.dim,
    cx: Math.round(view.cx), cz: Math.round(view.cz), crit: readCriteria(), at: Date.now()
  });
  try { localStorage.setItem('searchHistory', JSON.stringify(searchHistory)); } catch { /* ignore */ }
  buildHistList();
}
function replayHistory(h) {
  $('#seed').value = h.seed; $('#large').checked = h.large;
  world.seed = h.seed; world.large = h.large;
  world.mc = h.mc; $('#mcver').value = String(h.mc);
  if (world.dim !== h.dim) { setDimension(h.dim); $('#dimSel').value = String(h.dim); }
  applyCriteria(h.crit);
  view.cx = h.cx; view.cz = h.cz;
  curReset(); draw(); requestRender(0); syncHash();
  runSearch();
}
function buildHistList() {
  const box = $('#histList');
  box.textContent = '';
  if (!searchHistory.length) {
    const p = document.createElement('p');
    p.className = 'muted small'; p.dataset.i18n = 'historyEmpty'; p.textContent = t('historyEmpty');
    box.appendChild(p);
    return;
  }
  for (const h of searchHistory) {
    const dimName = t((DIMENSIONS.find(([v]) => v === h.dim) || DIMENSIONS[0])[2]);
    const btn = document.createElement('button');
    btn.className = 'hist mono';
    btn.textContent = `${h.seed} · ${dimName} · ${h.cx}, ${h.cz}`;
    btn.title = t('historyReplay');
    btn.dataset.i18nTitle = 'historyReplay';
    btn.onclick = () => replayHistory(h);
    box.appendChild(btn);
  }
}
let userPresets = parseUserPresets((() => {
  try { return localStorage.getItem('userPresets'); } catch { return null; }
})());
function saveUserPresets() {
  try { localStorage.setItem('userPresets', JSON.stringify(userPresets)); } catch { /* ignore */ }
}
let userMarkers = parseMarkers((() => {
  try { return localStorage.getItem('markers'); } catch { return null; }
})());
function setUserMarkers(list) {
  userMarkers = list;
  try { localStorage.setItem('markers', JSON.stringify(userMarkers)); } catch { /* ignore */ }
  buildMarkerList(); draw();
}
let userZones = parseZones((() => {
  try { return localStorage.getItem('zones'); } catch { return null; }
})());
function setUserZones(list) {
  userZones = list;
  try { localStorage.setItem('zones', JSON.stringify(userZones)); } catch { /* ignore */ }
  draw();
}
let markerMode = false;
function setMarkerMode(on) {
  markerMode = on;
  $('#markerBtn').classList.toggle('on', on);
  canvas.style.cursor = on ? 'crosshair' : '';
}
function buildMarkerList() {
  const box = $('#markerList');
  box.textContent = '';
  const list = markersFor(userMarkers, world);
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'muted small'; p.dataset.i18n = 'markersEmpty'; p.textContent = t('markersEmpty');
    box.appendChild(p);
    return;
  }
  for (const m of list) box.appendChild(markerRow(m));
}
function markerRow(m) {
  const row = document.createElement('div');
  row.className = 'fav';
  const go = document.createElement('button');
  go.className = 'fav-go mono'; go.textContent = `${m.x}, ${m.z}`;
  go.onclick = () => {
    view.cx = m.x; view.cz = m.z;
    draw(); requestRender(0); syncHash();
  };
  const name = document.createElement('input');
  name.className = 'fav-note'; name.value = m.name;
  name.maxLength = 60;
  name.onchange = () => setUserMarkers(renameMarker(userMarkers, m.id, name.value));
  const rm = document.createElement('button');
  rm.className = 'rm'; rm.textContent = '×'; rm.title = t('remove'); rm.dataset.i18nTitle = 'remove';
  rm.onclick = () => setUserMarkers(removeMarker(userMarkers, m.id));
  row.append(go, name, rm);
  return row;
}
let favorites = parseFavorites((() => {
  try { return localStorage.getItem('favorites'); } catch { return null; }
})());
function setFavorites(list) {
  favorites = list;
  try { localStorage.setItem('favorites', JSON.stringify(favorites)); } catch { /* ignore */ }
  buildFavList();
  draw();
}
function favSpot(p) {
  return { seed: world.seed, mc: world.mc, large: world.large, dim: world.dim, x: p.x, z: p.z };
}
function favStarButton(p) {
  const btn = document.createElement('button');
  btn.className = 'pop-fav';
  const paint = () => {
    const cur = findFavorite(favorites, world, p);
    btn.textContent = cur ? '★' : '☆';
    btn.title = t(cur ? 'favRemove' : 'favAdd');
  };
  paint();
  btn.onclick = () => {
    const cur = findFavorite(favorites, world, p);
    setFavorites(cur ? removeFavorite(favorites, cur.id) : addFavorite(favorites, favSpot(p)));
    paint();
  };
  return btn;
}
function buildFavList() {
  const box = $('#favList');
  box.textContent = '';
  const favs = favoritesFor(favorites, world);
  if (!favs.length) {
    const p = document.createElement('p');
    p.className = 'muted small'; p.dataset.i18n = 'favEmpty'; p.textContent = t('favEmpty');
    box.appendChild(p);
    return;
  }
  favs.forEach((f) => box.appendChild(favRow(f)));
}
function favRow(f) {
  const row = document.createElement('div');
  row.className = 'fav';
  const go = document.createElement('button');
  go.className = 'fav-go mono'; go.textContent = `${f.x}, ${f.z}`;
  go.onclick = () => {
    view.cx = f.x; view.cz = f.z;
    if (view.bpp > 4) view.bpp = 3;
    draw(); requestRender(0); syncHash();
  };
  const note = document.createElement('input');
  note.className = 'fav-note'; note.value = f.note;
  note.placeholder = t('favNote'); note.maxLength = 120;
  note.onchange = () => setFavorites(updateFavoriteNote(favorites, f.id, note.value));
  const rm = document.createElement('button');
  rm.className = 'rm'; rm.textContent = '×'; rm.title = t('favRemove');
  rm.onclick = () => setFavorites(removeFavorite(favorites, f.id));
  row.append(go, note, rm);
  return row;
}

function hidePopup() {
  if (rarePin) { rarePin = null; draw(); }   // the rare pin lives with the popup
  if (selected !== -1) {
    selected = -1;
    [...resultsEl.children].forEach((c) => c.classList.remove('sel'));
    draw();
  }
  const pop = $('#popup');
  if (pop.open) pop.close();
}

// ---------- biome legend ----------
let highlightBiome = null;      // biome id dimming the rest of the map tile
let legendPresent = [];         // biome ids of the last full (non-highlight) tile
function setHighlight(id) {
  if (highlightBiome === id) return;
  highlightBiome = id;
  requestRender(0);
}
function buildLegend(present) {
  legendPresent = present;
  const box = $('#legendList');
  box.textContent = '';
  for (const e of legendEntries(present, biomesSorted, biomeLabel)) {
    const row = document.createElement('div');
    row.className = 'lg'; row.dataset.id = e.id;
    const dot = document.createElement('span');
    const [dr, dg, db] = dispRgb(e.id, e.rgb);
    dot.className = 'dot'; dot.style.background = `rgb(${dr},${dg},${db})`;
    const lbl = document.createElement('span');
    lbl.textContent = e.label;
    row.append(dot, lbl);
    row.onmouseenter = () => setHighlight(e.id);
    row.onmouseleave = () => setHighlight(null);
    box.appendChild(row);
  }
}
// map hover marks the biome under the cursor in the legend
function markLegend(id) {
  document.querySelectorAll('#legendList .lg').forEach((el) => {
    el.classList.toggle('hot', +el.dataset.id === id);
  });
}

// ---------- biome list / dropdowns ----------
function onBiomeList(list) {
  biomesSorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
  // structures: stable engine index -> i18n label key + dimension
  const structDefs = [
    [0, 'structVillage', 0], [1, 'structOutpost', 0], [2, 'structDesertPyramid', 0], [3, 'structJungleTemple', 0],
    [4, 'structWitchHut', 0], [5, 'structIgloo', 0], [6, 'structOceanRuin', 0], [7, 'structShipwreck', 0],
    [8, 'structMonument', 0], [9, 'structMansion', 0], [10, 'structRuinedPortal', 0], [11, 'structAncientCity', 0],
    [12, 'structBuriedTreasure', 0], [13, 'structTrailRuins', 0], [14, 'structTrialChamber', 0],
    [15, 'structFortress', -1], [16, 'structBastion', -1], [17, 'structRuinedPortalN', -1],
    [18, 'structEndCity', 1]
  ];
  resolveStructConsts(structDefs);
}
// The UI only knows stable indices; the worker maps them to cubiomes enum
// values (structConst in mcfinder.c) through a one-off round-trip.
function resolveStructConsts(defs) {
  const chan = (e) => {
    if (e.data.type !== 'structConsts') return;
    worker.removeEventListener('message', chan);
    const vals = e.data.values;
    structToggles = [];
    defs.forEach((d, idx) => {
      structToggles.push({ type: vals[idx], labelKey: d[1], dim: d[2], on: false, color: structColors[idx % structColors.length], points: null });
    });
    // synthetic types the worker routes to dedicated code paths: slime chunks
    // (pure JS, slime.js), spawn point and strongholds (engine calls, markers.js)
    structToggles.push(
      { type: SLIME_STRUCT_TYPE, labelKey: 'structSlimeChunks', dim: 0, slime: true, on: false, color: '#6fce4e', points: null },
      { type: SPAWN_STRUCT_TYPE, labelKey: 'structSpawn', dim: 0, on: false, color: '#ff6b6b', points: null },
      { type: STRONGHOLD_STRUCT_TYPE, labelKey: 'structStronghold', dim: 0, on: false, color: '#c0b3ff', points: null },
      { type: QUADHUT_STRUCT_TYPE, labelKey: 'structQuadHut', dim: 0, on: false, color: '#ff9ff3', points: null }
    );
    buildStructToggleUI();
    applyHashCriteria();
  };
  worker.addEventListener('message', chan);
  send({ type: 'structConsts', indices: defs.map((d) => d[0]) });
}
function buildStructToggleUI() {
  const box = $('#structLayers'); box.textContent = '';
  structsOfDim().forEach((tg, i) => {
    const id = 'sl' + i;
    const row = document.createElement('label'); row.className = 'layer';
    const input = document.createElement('input');
    input.type = 'checkbox'; input.id = id; input.checked = tg.on;
    const dot = document.createElement('span');
    dot.className = 'dot'; dot.style.background = tg.color;
    const lbl = document.createElement('span');
    lbl.dataset.i18n = tg.labelKey; lbl.textContent = t(tg.labelKey);
    row.append(input, dot, lbl);
    input.onchange = (e) => {
      tg.on = e.target.checked;
      if (tg.on) { requestStructures(); return; }
      // both panes drop the layer at once (compare keeps no stale points)
      tg.points = null; cmpStructPoints.delete(tg.type); draw();
    };
    box.appendChild(row);
  });
}

// Current criteria as a plain object — used by the share hash and the exports.
function readCriteria() {
  return {
    mb: rowsOf('#mainBiomes').map((r) => Number.parseInt(r.querySelector('select').value, 10)),
    am: $('#adjMode').value,
    ac: rowsOf('#adjClauses').map((r) => {
      const ins = r.querySelectorAll('input.num');
      const y = Number.parseInt(ins[1].value, 10);
      return {
        b: Number.parseInt(r.querySelector('select').value, 10),
        d: Number.parseInt(ins[0].value, 10) || 0,
        n: r.querySelector('select.neg').value === '1' ? 1 : 0,
        ...(Number.isFinite(y) ? { yl: y } : {})
      };
    }),
    qm: $('#pctMode').value,
    qc: rowsOf('#pctClauses').map((r) => {
      const ins = r.querySelectorAll('input.num');
      return {
        b: Number.parseInt(r.querySelector('select').value, 10),
        p: Number.parseInt(ins[0].value, 10) || 0,
        d: Number.parseInt(ins[1].value, 10) || 0
      };
    }),
    hm: $('#shapeMode').value,
    hc: rowsOf('#shapeClauses').map((r) => {
      const sels = r.querySelectorAll('select');
      return {
        k: sels[0].value,
        a: [Number.parseInt(sels[1].value, 10)],
        b: [Number.parseInt(sels[2].value, 10)],
        mx: Number.parseInt(r.querySelector('input.num').value, 10) || 0
      };
    }),
    sm: $('#structMode').value,
    sc: rowsOf('#structClauses').map((r) => {
      const ins = r.querySelectorAll('input.num');
      return {
        t: Number.parseInt(r.querySelector('select').value, 10),
        mn: Number.parseInt(ins[0].value, 10) || 0,
        r: Number.parseInt(ins[1].value, 10) || 0,
        im: r.querySelector('input.inmain').checked ? 1 : 0
      };
    }),
    pc: rowsOf('#pairClauses').map((r) => {
      const sels = r.querySelectorAll('select');
      const ins = r.querySelectorAll('input.num');
      return {
        t1: Number.parseInt(sels[0].value, 10), t2: Number.parseInt(sels[1].value, 10),
        g: Number.parseInt(ins[0].value, 10) || 0, r: Number.parseInt(ins[1].value, 10) || 0
      };
    }),
    rg: $('#range').value, sp: $('#step').value,
    s0: $('#surfMin').value, s1: $('#surfMax').value
  };
}

// ---------- result export ----------
function mcLabel() {
  const v = MC_VERSIONS.find(([val]) => val === world.mc);
  return v ? v[1] : String(world.mc);
}
function downloadBlob(name, blob) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
// merge an imported profile file into every local store and report counts
function importProfileText(txt) {
  const info = $('#profileInfo');
  const imported = parseProfile(txt);
  if (!imported) {
    info.textContent = t('profileInvalid');
    return;
  }
  const merged = mergeProfile(
    { favorites, userPresets, history: searchHistory, markers: userMarkers, zones: userZones }, imported);
  setFavorites(merged.favorites);
  userPresets = merged.userPresets; saveUserPresets(); buildPresetSelect();
  searchHistory = merged.history;
  try { localStorage.setItem('searchHistory', JSON.stringify(searchHistory)); } catch { /* ignore */ }
  buildHistList();
  setUserMarkers(merged.markers);
  setUserZones(merged.zones);
  info.textContent = t('profileImported', {
    f: imported.favorites.length, p: imported.userPresets.length,
    h: imported.history.length, m: imported.markers.length, z: imported.zones.length
  });
}
function downloadFile(name, text, mime) {
  downloadBlob(name, new Blob([text], { type: mime }));
}

// snapshot of the current map view (tiles, layers, pins) + a cartouche band
function exportMapPNG() {
  const band = Math.round(64 * dpr);
  const out = document.createElement('canvas');
  out.width = canvas.width; out.height = canvas.height + band;
  const o = out.getContext('2d');
  o.drawImage(canvas, 0, 0);
  o.fillStyle = mapBg;
  o.fillRect(0, canvas.height, out.width, band);
  o.fillStyle = mapText;
  o.font = `${Math.round(12 * dpr)}px monospace`;
  const lines = mapCartoucheLines({
    seed: world.seed, mcLabel: mcLabel(), large: world.large,
    dimension: (DIMENSIONS.find(([v]) => v === world.dim) || [0, 'Overworld'])[1],
    cx: Math.round(view.cx), cz: Math.round(view.cz)
  });
  lines.forEach((ln, i) => o.fillText(ln, Math.round(10 * dpr), canvas.height + Math.round((18 + i * 17) * dpr)));
  out.toBlob((blob) => { if (blob) downloadBlob(exportFileName(world.seed, 'map', 'png'), blob); }, 'image/png');
}

// ---------- high-resolution map export (#231) ----------
// The current view is re-rendered at 2048/4096 px in the search worker (idle
// unless a search runs), band by band, with the same progress-bar + cancel
// button pattern as the cancellable search (#20).
let exportReq = 0, exportBusy = false;
let exportJob = null;   // {out, o, geom} while an HD export runs
function setExportBusy(on) {
  exportBusy = on;
  const btn = $('#pngBtn');
  btn.dataset.i18n = on ? 'cancelBtn' : 'exportPng';
  btn.textContent = t(btn.dataset.i18n);
  const prog = $('#pngProgress');
  prog.hidden = !on;
  prog.value = 0;
  $('#pngSizeSel').disabled = on;
  if (!on) exportJob = null;
}
function exportError(key) {
  searchInfo.textContent = t(key);
  searchInfo.className = 'info err';
}
function startExportHD(outW) {
  const geom = hdExportGeometry(view, canvas.width / dpr, canvas.height / dpr, outW);
  if (!geom) { exportError('exportTooLarge'); return; }
  const m = cartoucheMetrics(geom.outW);
  let out, o = null;
  // memory guard: a canvas this large can fail to allocate outright
  try {
    out = document.createElement('canvas');
    out.width = geom.outW; out.height = geom.outH + m.band;
    o = out.getContext('2d');
  } catch { /* reported below */ }
  if (!o) { exportError('exportTooLarge'); return; }
  exportReq = reqSeq++;
  exportJob = { out, o, geom };
  setExportBusy(true);
  sendSearch({
    type: 'exportMap', reqId: exportReq, alt: altPalette,
    seed: world.seed, mc: world.mc, large: world.large, dim: world.dim, y: yLayer,
    ...geom
  });
}
function onExportBand(d) {
  if (d.reqId !== exportReq || !exportJob) return;
  try {
    exportJob.o.putImageData(new ImageData(new Uint8ClampedArray(d.rgba), exportJob.geom.outW, d.rowsPx), 0, d.py0);
  } catch {
    // pixel-buffer allocation failed: abort the worker job and report
    sendSearch({ type: 'cancelExport', reqId: exportReq });
    setExportBusy(false);
    exportError('exportTooLarge');
    return;
  }
  $('#pngProgress').value = Math.round(100 * (d.py0 + d.rowsPx) / exportJob.geom.outH);
}
function onExportDone(d) {
  if (d.reqId !== exportReq || !exportJob) return;
  const job = exportJob;
  setExportBusy(false);
  if (d.error) {
    if (d.error !== 'cancelled') exportError('exportFailed');
    return;
  }
  finishExportHD(job);
}
// stamp the proportionally scaled cartouche band and trigger the download
function finishExportHD(job) {
  const { out, o, geom } = job;
  const m = cartoucheMetrics(geom.outW);
  o.fillStyle = mapBg;
  o.fillRect(0, geom.outH, geom.outW, m.band);
  o.fillStyle = mapText;
  o.font = `${m.font}px monospace`;
  const lines = mapCartoucheLines({
    seed: world.seed, mcLabel: mcLabel(), large: world.large,
    dimension: (DIMENSIONS.find(([v]) => v === world.dim) || [0, 'Overworld'])[1],
    cx: Math.round(view.cx), cz: Math.round(view.cz)
  });
  lines.forEach((ln, i) => o.fillText(ln, m.padX, geom.outH + m.baseline + i * m.lineStep));
  out.toBlob((blob) => {
    if (blob) downloadBlob(exportFileName(world.seed, `map-${geom.outW}`, 'png'), blob);
    else exportError('exportFailed');
  }, 'image/png');
}

function exportResults(fmt) {
  if (!pins.length) return;
  const c = readCriteria();
  const meta = {
    seed: world.seed, mcLabel: mcLabel(), large: world.large,
    dimension: (DIMENSIONS.find(([v]) => v === world.dim) || [0, 'Overworld'])[1],
    criteria: {
      mainBiomes: c.mb,
      adjacentMode: c.am,
      adjacent: c.ac.map((a) => ({ biome: a.b, within: a.d, absent: !!a.n })),
      structureMode: c.sm,
      structures: c.sc.map((s) => ({ type: s.t, atLeast: s.mn, within: s.r })),
      searchRadius: Number.parseInt(c.rg, 10) || 0,
      step: Number.parseInt(c.sp, 10) || 0,
      surfaceMin: c.s0 === '' ? null : Number.parseInt(c.s0, 10),
      surfaceMax: c.s1 === '' ? null : Number.parseInt(c.s1, 10)
    }
  };
  const base = `seedcartographer-${String(world.seed).replace(/[^\w-]+/g, '_')}`;
  if (fmt === 'csv') downloadFile(base + '.csv', resultsToCSV(pins, meta), 'text/csv');
  else downloadFile(base + '.json', resultsToJSON(pins, meta), 'application/json');
}

// ---------- seed gallery modal ----------
// The gallery opens in a dialog: cards built from gallery.json, each with a
// thumbnail of the spot rendered by the engine (the worker's `render` handler
// takes the seed/version/dimension per request, so previews never disturb the
// current map — its next tile carries the live world again).
let galleryEntries = null;                 // validated gallery.json, fetched once
const galleryThumbCache = new Map();       // entry id -> thumbnail canvas
const GALLERY_THUMB_W = 260, GALLERY_THUMB_H = 140;
function galleryThumbCanvas(e) {
  let cv = galleryThumbCache.get(e.id);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = GALLERY_THUMB_W; cv.height = GALLERY_THUMB_H;
  cv.className = 'gallerythumb';
  galleryThumbCache.set(e.id, cv);
  const reqId = reqSeq++;
  galleryThumbReqs.set(reqId, { e, cv });
  send(galleryThumbRender(e, reqId, GALLERY_THUMB_W, GALLERY_THUMB_H));
  return cv;
}
// once the preview pixels are in, overlay the spot's structures — box-scoped
// marker layers only: slime chunks would flood a thumbnail this small, and
// the spawn/stronghold layers are world-global engine calls that cost seconds
// per card without ever landing inside the preview box
function requestGalleryStructs(e, cv) {
  const skip = new Set([SLIME_STRUCT_TYPE, SPAWN_STRUCT_TYPE, STRONGHOLD_STRUCT_TYPE]);
  const layers = structToggles.filter((tg) => tg.dim === e.dim && !skip.has(tg.type));
  if (!layers.length) return;
  const reqId = reqSeq++;
  galleryStructReqs.set(reqId, { e, cv, colors: new Map(layers.map((tg) => [tg.type, tg.color])) });
  send(galleryStructRender(e, reqId, GALLERY_THUMB_W, GALLERY_THUMB_H, layers.map((tg) => tg.type)));
}
function drawGalleryStructs(d) {
  const req = galleryStructReqs.get(d.reqId);
  galleryStructReqs.delete(d.reqId);
  const c2 = req.cv.getContext('2d');
  c2.strokeStyle = 'rgba(0,0,0,.55)'; c2.lineWidth = 1;
  for (const g of d.groups) {
    c2.fillStyle = req.colors.get(g.type) || '#fff';
    for (const [x, z] of g.points) {
      const { px, py } = galleryThumbPoint(req.e, req.cv.width, req.cv.height, x, z);
      if (px < 0 || py < 0 || px > req.cv.width || py > req.cv.height) continue;
      c2.beginPath(); c2.rect(px - 3, py - 3, 6, 6); c2.fill(); c2.stroke();
    }
  }
}
// jump the app onto the entry: world, view, altitude and (when the entry
// carries them) pre-filled criteria — same order as applying a user preset
function applyGalleryEntry(e) {
  $('#galleryDlg').close();
  if (world.dim !== e.dim) { setDimension(e.dim); $('#dimSel').value = String(e.dim); }
  world.seed = e.seed; $('#seed').value = e.seed;
  world.large = e.large; $('#large').checked = e.large;
  world.mc = e.mc; $('#mcver').value = String(e.mc);
  yLayer = e.y; $('#ySlider').value = String(e.y); $('#yVal').textContent = String(e.y);
  view.cx = e.x; view.cz = e.z; view.bpp = e.b;
  if (e.c) applyCriteria(e.c);
  curReset(); draw(); requestRender(0); syncHash();
}
// rebuilt on every open, so titles/descriptions follow the current language;
// thumbnails are cached per entry and re-attached
function buildGalleryCards() {
  const box = $('#galleryCards');
  box.textContent = '';
  for (const e of galleryEntries) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'gallerycard';
    const h = document.createElement('h3');
    h.textContent = galleryText(e.title, currentLang());
    const p = document.createElement('p');
    p.textContent = galleryText(e.desc, currentLang());
    const meta = document.createElement('p');
    meta.className = 'mono gallerymeta';
    meta.textContent = `seed ${e.seed} · ${e.x}, ${e.z}`;
    card.append(galleryThumbCanvas(e), h, p, meta);
    card.onclick = () => applyGalleryEntry(e);
    box.appendChild(card);
  }
}
function openGallery() {
  $('#galleryDlg').showModal();
  if (galleryEntries) { buildGalleryCards(); return; }
  fetch('./gallery.json')
    .then((r) => r.json())
    .then((raw) => { galleryEntries = validateGallery(raw); buildGalleryCards(); })
    .catch(() => { $('#galleryCards').textContent = t('galleryFailed'); });
}

// ---------- URL hash sharing ----------
let hashSeq = 0;   // only the freshest encode may write the hash (async races)
function syncHash() {
  const state = {
    s: world.seed, m: world.mc, l: world.large ? 1 : 0, d: world.dim, y: yLayer,
    x: Math.round(view.cx), z: Math.round(view.cz), b: +view.bpp.toFixed(2),
    c: readCriteria()
  };
  const seq = ++hashSeq;
  return encodeShareHash(state).then((h) => {
    if (seq === hashSeq) history.replaceState(null, '', '#' + h);
  });
}
function readHash() {
  return decodeShareHash(location.hash.slice(1));
}
// Rebuild the criteria rows from a share-link-shaped `c` object. Values may
// be attacker-controlled (share links): coerce everything to integers and cap
// list sizes before building any DOM from them.
function applyCriteria(raw) {
  $('#mainBiomes').textContent = ''; $('#adjClauses').textContent = ''; $('#structClauses').textContent = ''; $('#pctClauses').textContent = ''; $('#shapeClauses').textContent = '';
  $('#pairClauses').textContent = '';
  collapseCritSections();
  $('#surfMin').value = ''; $('#surfMax').value = '';
  const c = sanitizeCriteria(raw, MAX_CRIT_ROWS);
  if (!c) return;
  c.mb.forEach((b) => addMainBiomeRow(b));
  $('#adjMode').value = c.am;
  c.ac.forEach((r) => addAdjRow(r.b, r.d, r.n, r.yl));
  $('#pctMode').value = c.qm;
  c.qc.forEach((r) => addPctRow(r.b, r.p, r.d));
  $('#shapeMode').value = c.hm;
  c.hc.forEach((r) => addShapeRow(r.k, r.a[0], r.b[0], r.mx));
  $('#structMode').value = c.sm;
  c.sc.forEach((r) => addStructRow(r.t, r.mn, r.r, r.im));
  c.pc.forEach((r) => addPairRow(r.t1, r.t2, r.g, r.r));
  if (c.rg !== null) $('#range').value = c.rg;
  if (c.sp !== null) $('#step').value = c.sp;
  if (c.s0 !== null) $('#surfMin').value = c.s0;
  if (c.s1 !== null) $('#surfMax').value = c.s1;
}

let hashState = null;
function applyHashCriteria() {
  // called once biome/structure lists exist; builds the criteria rows from
  // the hash, or falls back to sensible demo defaults
  // legacy single-criteria share links (c.a = main biome id) are migrated
  const c = normalizeLegacyCriteria(hashState?.c);
  applyCriteria(c);
  if (!rowsOf('#mainBiomes').length) {
    // demo: cherry grove + warm ocean + >=2 villages (matches built-in seed 141)
    addMainBiomeRow(185); addAdjRow(44, 400); addStructRow(structToggles[0].type, 2, 800);
    if (!c) { $('#range').value = 5000; $('#step').value = 16; }
  }
}

// ---------- criteria presets ----------
function updatePresetDelBtn() {
  $('#presetDel').hidden = !$('#presetSel').value.startsWith('u:');
}
function buildPresetSelect() {
  const sel = $('#presetSel');
  sel.textContent = '';   // rebuilt whenever the custom presets change
  const ph = document.createElement('option');
  ph.value = ''; ph.dataset.i18n = 'presetPlaceholder'; ph.textContent = t('presetPlaceholder');
  sel.appendChild(ph);
  for (const p of PRESETS) {
    const o = document.createElement('option');
    o.value = p.id; o.dataset.i18n = p.labelKey; o.textContent = t(p.labelKey);
    sel.appendChild(o);
  }
  if (userPresets.length) {
    const grp = document.createElement('optgroup');
    grp.label = t('presetCustomGroup'); grp.dataset.i18nLabel = 'presetCustomGroup';
    for (const p of userPresets) {
      const o = document.createElement('option');
      o.value = 'u:' + p.id; o.textContent = p.name;
      grp.appendChild(o);
    }
    sel.appendChild(grp);
  }
  sel.onchange = () => {
    const chosen = sel.value;
    const user = userPresets.find((p) => 'u:' + p.id === chosen);
    if (user) {
      // a custom preset carries its own dimension
      if (world.dim !== user.dim) { setDimension(user.dim); $('#dimSel').value = String(user.dim); }
      applyCriteria(user.c);
    } else {
      const preset = PRESETS.find((p) => p.id === chosen);
      if (!preset) { updatePresetDelBtn(); return; }
      // built-in presets are Overworld recipes; leave the current dimension first
      if (world.dim !== 0) { setDimension(0); $('#dimSel').value = '0'; }
      applyCriteria(presetCriteria(preset, structToggles.map((tg) => tg.type)));
    }
    sel.value = chosen;   // setDimension may have reset the picker
    updatePresetDelBtn();
    syncHash();
  };
  updatePresetDelBtn();
}
function wirePresetSave() {
  const nameInput = $('#presetName'), sel = $('#presetSel');
  $('#presetSave').onclick = () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.classList.add('bad'); return; }
    userPresets = addUserPreset(userPresets, name, world.dim, readCriteria());
    saveUserPresets();
    buildPresetSelect();
  wirePresetSave();
    const saved = userPresets.find((p) => p.name === name.slice(0, USER_PRESET_NAME_MAX));
    if (saved) sel.value = 'u:' + saved.id;
    updatePresetDelBtn();
    nameInput.value = '';
  };
  nameInput.oninput = () => nameInput.classList.remove('bad');
  $('#presetDel').onclick = () => {
    const id = Number.parseInt(sel.value.slice(2), 10);
    userPresets = removeUserPreset(userPresets, id);
    saveUserPresets();
    buildPresetSelect();
  wirePresetSave();
    sel.value = '';
    updatePresetDelBtn();
  };
}

// ---------- high-visibility palette ----------
let altPalette = (() => {
  try { return localStorage.getItem('palette') === 'alt'; } catch { return false; }
})();
// display color of a biome swatch (legend, dropdown dots) under the mode
function dispRgb(id, rgb) { return altPalette ? altRgb(id, rgb) : rgb; }
function applyPalette(alt, persist) {
  altPalette = alt;
  $('#paletteBtn').classList.toggle('on', alt);
  $('#paletteBtn').setAttribute('aria-pressed', String(alt));
  if (persist) { try { localStorage.setItem('palette', alt ? 'alt' : 'default'); } catch { /* ignore */ } }
  send({ type: 'palette', alt });
  // every cached or in-flight tile was painted with the old table
  tileCache.clear(); pendingTiles.clear(); tileQueue = []; minimapTile = null;
  if (cmpWorker) {
    post(cmpWorker, { type: 'palette', alt });
    cmpTileCache.clear(); cmpPendingTiles.clear(); cmpTileQueue = [];
  }
  draw(); requestRender(0); requestMinimap(0);
  buildLegend(legendPresent);
}

// ---------- theme ----------
let curTheme = 'dark';
let mapBg = '#0c1016', mapText = '#dfe7f1';   // canvas colors, refreshed per theme
function applyTheme(theme, persist) {
  curTheme = theme;
  document.documentElement.dataset.theme = theme;
  if (persist) { try { localStorage.setItem('theme', theme); } catch { /* ignore */ } }
  document.querySelector('meta[name="theme-color"]').setAttribute('content', THEME_COLORS[theme]);
  const cs = getComputedStyle(document.documentElement);
  mapBg = cs.getPropertyValue('--map-bg').trim() || mapBg;
  mapText = cs.getPropertyValue('--text').trim() || mapText;
  const btn = $('#themeBtn');
  btn.textContent = theme === 'dark' ? '☀' : '☾';
  btn.title = t('themeToggle');
  draw();
}
function initTheme() {
  let stored = null;
  try { stored = localStorage.getItem('theme'); } catch { /* ignore */ }
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  applyTheme(resolveTheme(stored, prefersLight), false);
  $('#themeBtn').onclick = () => applyTheme(otherTheme(curTheme), true);
  $('#paletteBtn').onclick = () => applyPalette(!altPalette, true);
  if (altPalette) applyPalette(true, false);
}

// ---------- "⋯" overflow menu (#266) ----------
// Secondary topbar actions (export, share, compare, language, theme…) live
// in a keyboard-accessible popover of native controls, so the main topbar
// never overflows horizontally. On small screens the world options (Large
// Biomes, Java version, dimension) relocate into the menu too — the nodes
// themselves move, so every control keeps its id and its handlers.
function setMoreMenu(open) {
  $('#moreMenu').hidden = !open;
  $('#moreBtn').setAttribute('aria-expanded', String(open));
}
function placeWorldOpts(compact) {
  const opts = $('#worldOpts');
  if (compact) $('#menuWorldSlot').append(opts);
  else $('#loadBtn').before(opts);
}
function initMoreMenu() {
  const btn = $('#moreBtn'), menu = $('#moreMenu');
  btn.onclick = () => setMoreMenu(menu.hidden);
  // a click/tap anywhere else dismisses the menu
  document.addEventListener('pointerdown', (e) => {
    const t = e.target instanceof Node ? e.target : null;
    if (!menu.hidden && !(t && (menu.contains(t) || btn.contains(t)))) setMoreMenu(false);
  });
  // Escape from inside the menu closes it and returns focus to its button
  menu.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    setMoreMenu(false);
    btn.focus();
  });
  const mq = window.matchMedia('(max-width:820px)');
  mq.addEventListener('change', () => placeWorldOpts(mq.matches));
  placeWorldOpts(mq.matches);
}

// ---------- first-visit guided tour (#229) ----------
// DOM glue over the pure logic in tour.js: overlay + highlight ring + bubble
// positioned next to the real UI elements, keyboard-driven (Tab trapped in
// the bubble, Enter = next, Escape = skip). localStorage remembers the tour
// was seen; a storage error never blocks the app (and never re-nags either).
function tourSeenValue() {
  try { return localStorage.getItem(TOUR_SEEN_KEY); } catch { return 'unavailable'; }
}
function markTourSeen() {
  try { localStorage.setItem(TOUR_SEEN_KEY, '1'); } catch { /* ignore */ }
}
let tourUi = null;   // { overlay, ring, bubble, text, counter, next, skip, step }
function endTour() {
  if (!tourUi) return;
  window.removeEventListener('resize', tourReposition);
  tourUi.overlay.remove(); tourUi.ring.remove(); tourUi.bubble.remove();
  tourUi = null;
  setMoreMenu(false);   // step 4 may have opened the "⋯" menu (#266)
  markTourSeen();
}
function tourReposition() {
  if (!tourUi) return;
  const el = document.querySelector(TOUR_STEPS[tourUi.step].target);
  el.scrollIntoView({ block: 'nearest' });   // panel targets may be below the fold
  const r = el.getBoundingClientRect();
  const ring = tourUi.ring;
  ring.style.left = (r.left - 5) + 'px';
  ring.style.top = (r.top - 5) + 'px';
  ring.style.width = (r.width + 10) + 'px';
  ring.style.height = (r.height + 10) + 'px';
  const b = tourUi.bubble;
  const p = tourBubblePosition(r, { width: b.offsetWidth, height: b.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight });
  b.style.left = p.left + 'px';
  b.style.top = p.top + 'px';
}
function tourShowStep(step) {
  tourUi.step = step;
  // targets living in the "⋯" menu (share link) need the menu open (#266)
  setMoreMenu($('#moreMenu').contains(document.querySelector(TOUR_STEPS[step].target)));
  tourUi.text.textContent = t(TOUR_STEPS[step].key);
  tourUi.counter.textContent = t('tourProgress', { n: step + 1, t: TOUR_STEPS.length });
  tourUi.next.textContent = t(isLastStep(step, TOUR_STEPS.length) ? 'tourDone' : 'tourNext');
  tourUi.bubble.setAttribute('aria-label', t('tourProgress', { n: step + 1, t: TOUR_STEPS.length }));
  tourReposition();
  tourUi.next.focus();
}
function startTour() {
  if (tourUi) return;
  const mk = (tag, cls) => { const el = document.createElement(tag); el.className = cls; document.body.append(el); return el; };
  const overlay = mk('div', 'tour-overlay');
  const ring = mk('div', 'tour-ring');
  const bubble = mk('div', 'tour-bubble');
  bubble.setAttribute('role', 'dialog');
  bubble.setAttribute('aria-modal', 'true');
  const text = document.createElement('p');
  text.className = 'tour-text';
  const counter = document.createElement('span');
  counter.className = 'tour-counter mono';
  const skip = document.createElement('button');
  skip.className = 'btn tiny tour-skip';
  skip.textContent = t('tourSkip');
  const next = document.createElement('button');
  next.className = 'btn tiny tour-next';
  const row = document.createElement('div');
  row.className = 'tour-row';
  row.append(counter, skip, next);
  bubble.append(text, row);
  tourUi = { overlay, ring, bubble, text, counter, next, skip, step: 0 };
  next.onclick = () => {
    const n = nextStep(tourUi.step, TOUR_STEPS.length);
    if (n === -1) endTour(); else tourShowStep(n);
  };
  skip.onclick = endTour;
  overlay.onclick = endTour;
  bubble.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); endTour(); return; }
    // the bubble is the keyboard world while the tour runs: Tab cycles
    // between its two buttons, in both directions
    if (e.key === 'Tab') {
      e.preventDefault();
      (document.activeElement === next ? skip : next).focus();
    }
  });
  window.addEventListener('resize', tourReposition);
  tourShowStep(0);
}

// ---------- global keyboard shortcuts (#230) ----------
// DOM glue over the pure mapping in keys.js: build the simplified context
// from the event, then run the returned action. Handlers that already
// consumed the key (canvas pan/zoom, tour bubble, criteria rows…) call
// preventDefault first, so this never doubles them up.
// 'close' cascades: dialogs first, then the active tool / pin popup
function closeTopmost() {
  const help = $('#helpDlg'), gallery = $('#galleryDlg');
  if (help.open) { help.close(); return; }
  if (gallery.open) { gallery.close(); return; }
  if (!$('#moreMenu').hidden) { setMoreMenu(false); return; }
  dismissMapTools();
}
const KEY_ACTIONS = {
  'skip-tour': () => endTour(),
  search: () => { if (!searchBusy) runSearch(); },
  'zoom-in': () => zoomBy(1 / 1.3),
  'zoom-out': () => zoomBy(1.3),
  goto: () => $('#gotoInput').focus(),
  ruler: () => setRulerOn(!ruler.on),
  help: () => $('#helpDlg').showModal(),
  close: closeTopmost
};
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return;
  const el = /** @type {Element} */ (e.target instanceof Element ? e.target : null);
  const tag = el ? el.tagName : '';
  const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  const action = keyAction({
    key: e.key,
    mod: e.ctrlKey || e.metaKey || e.altKey,
    inInput,
    // Enter submits the search from any field of the criteria card only;
    // other fields (goto box, marker/favorite notes, sync code…) keep
    // their own Enter behavior
    inSearchField: inInput && tag !== 'TEXTAREA' && el.closest('#criteriaCard') !== null,
    tourOpen: tourUi !== null,
    dialogOpen: $('#helpDlg').open || $('#galleryDlg').open
  });
  if (!action) return;
  e.preventDefault();
  KEY_ACTIONS[action]();
});

// ---------- init ----------
async function init() {
  hashState = await readHash();
  const wv = sanitizeWorldView(hashState);
  if (wv) {
    world.seed = wv.seed;
    world.mc = wv.mc;
    world.large = wv.large;
    world.dim = wv.dim;
    if (wv.cx !== null) view.cx = wv.cx;
    if (wv.cz !== null) view.cz = wv.cz;
    if (wv.bpp !== null) view.bpp = wv.bpp;
    if (wv.y !== null) yLayer = wv.y;
  }
  $('#seed').value = world.seed;
  $('#large').checked = world.large;
  $('#loadBtn').onclick = () => {
    world.seed = $('#seed').value || '0'; world.large = $('#large').checked;
    curReset(); requestRender(0); syncHash();
  };
  $('#searchBtn').onclick = () => {
    if (searchBusy) sendSearch({ type: 'cancelSearch', reqId: searchReq });
    else runSearch();
  };
  $('#cmpBtn').onclick = () => setCompareMode(!cmpState.on);
  $('#cmpClose').onclick = () => setCompareMode(false);
  $('#cmpSeed').onchange = applyCompareSeed;
  $('#seedResumeBtn').onclick = resumeSeedSearch;
  updateSeedResumeBtn();
  $('#seedSearchBtn').onclick = () => {
    if (seedBusy) cancelSeedSearch();
    else startSeedSearch();
  };
  $('#pngBtn').onclick = () => {
    if (exportBusy) { sendSearch({ type: 'cancelExport', reqId: exportReq }); return; }
    const size = $('#pngSizeSel').value;
    if (size === 'view') exportMapPNG();
    else startExportHD(Number.parseInt(size, 10));
  };
  const importInput = $('#importFile');
  $('#importCsv').onclick = () => importInput.click();
  importInput.onchange = () => {
    if (importInput.files[0]) importLocationsCSV(importInput.files[0]);
    importInput.value = '';   // allow re-importing the same file
  };
  $('#exportCsv').onclick = () => exportResults('csv');
  $('#exportJson').onclick = () => exportResults('json');
  buildPresetSelect();
  wirePresetSave();
  buildRareBiomeUI();
  $('#addMainBiome').onclick = () => addMainBiomeRow();
  $('#addAdj').onclick = () => addAdjRow();
  $('#addPct').onclick = () => addPctRow();
  $('#addShape').onclick = () => addShapeRow();
  $('#addStruct').onclick = () => addStructRow();
  $('#addPair').onclick = () => addPairRow();
  $('#shareBtn').onclick = () => {
    syncHash().then(() => copyText(location.href))
      .then(() => { $('#shareBtn').textContent = t('linkCopied'); })
      .catch(() => { $('#shareBtn').textContent = t('copyFailed'); });
    setTimeout(() => $('#shareBtn').textContent = t('shareLink'), 1300);
  };
  const langSel = $('#langSel');
  for (const [code, name] of I18N_LANGS) {
    const o = document.createElement('option');
    o.value = code; o.textContent = name;
    langSel.appendChild(o);
  }
  langSel.value = currentLang();
  // dynamic rows carry data-i18n attributes, so applyI18n (via setLang) covers them
  langSel.onchange = () => { setLang(langSel.value); hidePopup(); buildFavList(); buildLegend(legendPresent); };
  $('#gridChk').onchange = (e) => { showGrid = e.target.checked; draw(); };
  $('#netherChk').onchange = (e) => { showNetherGrid = e.target.checked; draw(); };
  // relief is baked into the tile pixels: re-request tiles under the new key
  $('#reliefChk').onchange = (e) => { showRelief = e.target.checked; requestRender(0); };
  $('#sortSel').onchange = (e) => {
    sortMode = e.target.value;
    applySort(); selected = -1; hidePopup(); renderResultsList(); draw();
  };
  const ySlider = $('#ySlider'), yVal = $('#yVal');
  ySlider.value = String(yLayer); yVal.textContent = String(yLayer);
  ySlider.oninput = () => { yVal.textContent = ySlider.value; };
  ySlider.onchange = () => {
    yLayer = Math.min(320, Math.max(-64, Number.parseInt(ySlider.value, 10) || 0));
    requestRender(0); syncHash();
  };
  $('#minimap').addEventListener('click', (e) => {
    const mm = e.currentTarget;
    const r = mm.getBoundingClientRect();
    // border excluded: map the click onto the canvas pixel grid
    const px = (e.clientX - r.left - mm.clientLeft) * (mm.width / mm.clientWidth);
    const py = (e.clientY - r.top - mm.clientTop) * (mm.height / mm.clientHeight);
    const p = minimapClickToWorld(px, py, mm.width, mm.height, view);
    view.cx = p.x; view.cz = p.z;
    draw(); requestRender(0); syncHash();
  });
  const gotoInput = $('#gotoInput');
  $('#gotoForm').onsubmit = (e) => {
    e.preventDefault();
    const p = parseGotoInput(gotoInput.value);
    gotoInput.classList.toggle('bad', !p);
    if (!p) return;
    view.cx = p.x; view.cz = p.z;
    draw(); requestRender(0); syncHash();
  };
  gotoInput.oninput = () => gotoInput.classList.remove('bad');
  $('#rulerBtn').onclick = () => setRulerOn(!ruler.on);
  $('#markerBtn').onclick = () => setMarkerMode(!markerMode);
  $('#portalBtn').onclick = () => setPortalMode(!portalMode);
  $('#selBtn').onclick = () => setSelOn(!sel.on);
  $('#zoneBtn').onclick = () => setZoneOn(!zoneTool.on);
  $('#selPng').onclick = exportSelectionPNG;
  $('#selCopy').onclick = () => { copyText(formatRect(normalizeRect(sel.a, sel.b))); };
  $('#selClose').onclick = () => setSelOn(false);
  $('#markerExport').onclick = () => {
    downloadFile('seedcartographer-markers.json', JSON.stringify(userMarkers, null, 2), 'application/json');
  };
  const markerImportInput = $('#markerImportFile');
  $('#markerImport').onclick = () => markerImportInput.click();
  markerImportInput.onchange = () => {
    const f = markerImportInput.files[0];
    if (f) {
      f.text().then((txt) => setUserMarkers(mergeMarkers(userMarkers, parseMarkers(txt))));
    }
    markerImportInput.value = '';
  };
  // profile: one-file backup/restore of every local store
  $('#profileExport').onclick = () => {
    downloadFile('seedcartographer-profile.json',
      exportProfile({ favorites, userPresets, history: searchHistory, markers: userMarkers, zones: userZones }),
      'application/json');
  };
  const profileImportInput = $('#profileImportFile');
  $('#profileImport').onclick = () => profileImportInput.click();
  profileImportInput.onchange = () => {
    const f = profileImportInput.files[0];
    if (f) f.text().then(importProfileText);
    profileImportInput.value = '';
  };
  // sync code: same profile payload as export/import, moved via copy/paste
  // (a compressed 'z.' code, same codec as share links) instead of a file —
  // handy between devices with no easy file transfer.
  const syncBox = $('#syncCodeBox'), syncText = $('#syncCodeText'), syncApply = $('#syncCodeApply');
  $('#syncCodeShow').onclick = () => {
    encodeShareHash(JSON.parse(exportProfile({ favorites, userPresets, history: searchHistory, markers: userMarkers, zones: userZones })))
      .then((code) => { syncText.value = code; syncBox.hidden = false; syncApply.hidden = true; syncText.select(); });
  };
  $('#syncCodePaste').onclick = () => {
    syncText.value = '';
    syncBox.hidden = false;
    syncApply.hidden = false;
    syncText.focus();
  };
  $('#syncCodeCopy').onclick = () => { copyText(syncText.value).catch(() => {}); };
  syncApply.onclick = () => {
    decodeShareHash(syncText.value.trim()).then((decoded) => {
      if (decoded == null) { $('#profileInfo').textContent = t('profileInvalid'); return; }
      importProfileText(JSON.stringify(decoded));
      syncBox.hidden = true;
    });
  };
  // small screens: the criteria panel folds away so the map fills the screen
  $('#panelToggle').onclick = () => {
    const collapsed = document.body.classList.toggle('panel-collapsed');
    $('#panelToggle').setAttribute('aria-expanded', String(!collapsed));
    resize();   // the map area changed size
  };
  // deployed-build stamp (version.js, regenerated at deploy)
  $('#helpVersion').textContent = 'v' + APP_VERSION.version
    + (APP_VERSION.commit ? ` (${APP_VERSION.commit})` : '');
  $('#helpBtn').onclick = () => $('#helpDlg').showModal();
  $('#helpClose').onclick = () => $('#helpDlg').close();
  // the tour can be replayed anytime from the help dialog (#229)
  $('#tourReplay').onclick = () => { $('#helpDlg').close(); startTour(); };
  $('#galleryBtn').onclick = openGallery;
  $('#galleryClose').onclick = () => $('#galleryDlg').close();
  initMoreMenu();
  buildDimSelect();
  buildFavList();
  initTheme();
  buildHistList();
  buildMarkerList();
  applyI18n();
  resize();
  // first visit: walk the newcomer through seed → criteria → search → share
  if (isFirstVisit(tourSeenValue())) startTour();
  // discreet topbar indicator while the browser reports no connectivity (#253)
  const offlineBadge = $('#offlineBadge');
  const syncOfflineBadge = () => { offlineBadge.hidden = navigator.onLine; };
  window.addEventListener('online', syncOfflineBadge);
  window.addEventListener('offline', syncOfflineBadge);
  syncOfflineBadge();
  // offline support (PWA); requires a secure context, harmless otherwise
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline mode unavailable */ });
  }
}
function curReset() { tile = null; tileCache.clear(); structToggles.forEach((tg) => tg.points = null); cmpStructPoints.clear(); hidePopup(); buildFavList(); buildMarkerList(); }
// As a module, app.js no longer leaks its bindings into the page scope; the
// e2e suite reads these few (share-link round-trips, ruler state, tile-cache
// settling), so expose them explicitly. All are consts mutated in place.
Object.assign(window, {
  syncHash, decodeShareHash, ruler, tileCache, pendingTiles, rarePinAt: () => rarePin,
  portalState: () => portal,
  zonesOnMap: () => zonesFor(userZones, world),
  cmpTileCache, cmpPendingTiles, cmpStructPoints, compareOn: () => cmpState.on,
  viewCenter: () => ({ x: view.cx, z: view.cz, b: view.bpp })
});
await init();
