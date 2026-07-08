// app.js — UI, map rendering, search orchestration. Talks to worker.js.
'use strict';

// Two instances of the same engine worker: tiles/probes/structures on one,
// the sliced search job on the other, so a long search never delays a tile
// render or a biome probe (at the cost of a second WASM instance in memory).
const worker = new Worker('./worker.js');
const searchWorker = new Worker('./worker.js');
let MC_NEWEST = 28;
let reqSeq = 1;

// ---------- DOM ----------
const $ = (s) => document.querySelector(s);
const canvas = $('#map'), ctx = canvas.getContext('2d');
const hud = $('#hud'), resultsEl = $('#results'), searchInfo = $('#searchInfo');

// ---------- state ----------
const world = { seed: '141', mc: MC_NEWEST, large: false, dim: 0 };
let yLayer = 60;                                // altitude for tiles, probe and search
const DIMENSIONS = [[0, 'Overworld'], [-1, 'Nether'], [1, 'End']];
const view = { cx: -392, cz: 56, bpp: 2.2 };   // bpp = blocks per pixel
let tile = null;                                // {canvas, originX, originZ, scale, cols, rows}
let pins = [];                                  // [{x,z,count}]
let selected = -1;
// ruler tool: a/b world endpoints, b tracks the pointer until the 2nd click
const ruler = { on: false, a: null, b: null, done: false };
const structColors = ['#f2a73b','#7ee0c0','#c89bf0','#e07a7a','#7aa8e0','#d8d05a','#9ad06a','#e0a0c8'];
let structToggles = [];                         // [{type,label,on,color,points}]
let renderReq = 0, biomeProbeReq = 0;
let showGrid = false;                           // coordinate-grid overlay toggle
const tileCache = createTileCache();            // LRU of rendered tiles (pan/zoom reuse)
let minimapReq = 0, minimapTile = null;         // overview minimap tile

// ---------- worker plumbing ----------
// per-worker readiness + queue of messages sent before the engine was up
for (const w of [worker, searchWorker]) {
  w.engineReady = false;
  w.pending = [];
  w.onerror = (e) => console.error('WORKER ERROR:', e.message, e.filename, e.lineno);
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
    const wk = tileWorldKey(world, yLayer);
    tileCache.put({ ...tile, worldKey: wk, key: tileKey(wk, d.scale, d.originX, d.originZ) });
    buildLegend(d.present || []);
  }
  draw();
}
worker.onmessage = (e) => {
  const d = e.data;
  if (d.type === 'fatal') { showFatal(d.message); return; }
  if (d.type === 'ready') { onEngineReady(d); return; }
  if (d.type === 'biomeList') { onBiomeList(d.list); return; }
  if (d.type === 'tile') { onTileMessage(d); return; }
  if (d.type === 'structures') {
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
  const sel = $('#mcver');
  sel.textContent = '';
  const versions = MC_VERSIONS[0][0] === MC_NEWEST ? MC_VERSIONS : [[MC_NEWEST, 'newest']];
  for (const [v, label] of versions) {
    const o = document.createElement('option');
    o.value = v; o.textContent = label;
    sel.appendChild(o);
  }
  sel.value = String(world.mc);
  if (sel.value === '') { world.mc = MC_NEWEST; sel.value = String(MC_NEWEST); }
  sel.onchange = () => {
    world.mc = Number.parseInt(sel.value, 10);
    curReset(); draw(); requestRender(0); syncHash();
  };
}

// ---------- dimension ----------
function buildDimSelect() {
  const sel = $('#dimSel');
  for (const [v, label] of DIMENSIONS) {
    const o = document.createElement('option');
    o.value = v; o.textContent = label;
    sel.appendChild(o);
  }
  sel.value = String(world.dim);
  sel.onchange = () => setDimension(Number.parseInt(sel.value, 10));
}
function setDimension(dim) {
  world.dim = dim;
  // criteria and layers reference biomes/structures of the old dimension: rebuild
  $('#mainBiomes').textContent = ''; $('#adjClauses').textContent = ''; $('#structClauses').textContent = '';
  $('#pairClauses').textContent = '';
  const presetSel = $('#presetSel');
  if (presetSel) presetSel.value = '';   // criteria no longer match any preset
  addMainBiomeRow();
  structToggles.forEach((tg) => { tg.on = false; tg.points = null; });
  buildStructToggleUI();
  hidePopup();
  pins = []; resultsEl.innerHTML = ''; $('#exportBtns').hidden = true;
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
    // bounded: overdrawing the whole LRU every drag frame costs frame time
    for (const e of tilesInView(tileCache.entries(), tileWorldKey(world, yLayer), rect, 8)) drawTile(e);
  }

  // structure / slime layers (only points in view)
  for (const t of structToggles) {
    if (!t.on || !t.points) continue;
    if (t.slime) drawSlimeLayer(t.points, W, H);
    else drawStructMarkers(t, W, H);
  }

  drawFavMarkers(W, H);

  // result pins
  pins.forEach((p, i) => {
    const sx = w2sx(p.x), sy = w2sy(p.z);
    drawPin(sx, sy, i === selected);
  });

  if (showGrid) drawGrid(W, H);
  drawScaleBar(H);
  drawRuler();

  // center crosshair
  ctx.strokeStyle = curTheme === 'light' ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 2 - 7, H / 2); ctx.lineTo(W / 2 + 7, H / 2);
  ctx.moveTo(W / 2, H / 2 - 7); ctx.lineTo(W / 2, H / 2 + 7); ctx.stroke();
  ctx.restore();
}

function drawTile(e) {
  const px = w2sx(e.originX), py = w2sy(e.originZ);
  ctx.drawImage(e.canvas, px, py, e.cols * e.scale / view.bpp, e.rows * e.scale / view.bpp);
}

// adaptive coordinate grid: chunk/region multiples with edge labels
function drawGrid(W, H) {
  const { step } = gridSpec(view.bpp);
  const line = curTheme === 'light' ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.13)';
  const label = curTheme === 'light' ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.5)';
  ctx.strokeStyle = line; ctx.lineWidth = 1;
  ctx.fillStyle = label; ctx.font = '10px monospace';
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
  for (const wx of gridLines(s2wx(0), s2wx(W), step)) ctx.fillText(String(wx), w2sx(wx) + 3, 11);
  for (const wz of gridLines(s2wz(0), s2wz(H), step)) ctx.fillText(String(wz), 3, w2sy(wz) - 3);
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
    const bpp = view.bpp * MINIMAP_ZOOM_OUT;
    const px = (minimapTile.originX - view.cx) / bpp + mm.width / 2;
    const py = (minimapTile.originZ - view.cz) / bpp + mm.height / 2;
    c.imageSmoothingEnabled = false;
    c.drawImage(minimapTile.canvas, px, py,
      minimapTile.cols * minimapTile.scale / bpp, minimapTile.rows * minimapTile.scale / bpp);
  }
  const r = viewportRectOnMinimap(canvas.width / dpr, canvas.height / dpr, mm.width, mm.height);
  c.strokeStyle = '#f2a73b'; c.lineWidth = 1.5;
  c.strokeRect(r.x, r.y, r.w, r.h);
}

function drawStructMarkers(t, W, H) {
  ctx.fillStyle = t.color; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1;
  for (const [x, z] of t.points) {
    const sx = w2sx(x), sy = w2sy(z);
    if (sx < -8 || sy < -8 || sx > W + 8 || sy > H + 8) continue;
    ctx.beginPath(); ctx.rect(sx - 3, sy - 3, 6, 6); ctx.fill(); ctx.stroke();
  }
}
// slime chunks render as chunk-sized overlay squares rather than fixed markers
function drawSlimeLayer(points, W, H) {
  const size = 16 / view.bpp;
  ctx.fillStyle = 'rgba(111,206,78,.4)'; ctx.strokeStyle = 'rgba(30,80,20,.7)'; ctx.lineWidth = 1;
  for (const [x, z] of points) {
    const sx = w2sx(x), sy = w2sy(z);
    if (sx < -size || sy < -size || sx > W || sy > H) continue;
    ctx.beginPath(); ctx.rect(sx, sy, size, size); ctx.fill(); ctx.stroke();
  }
}

// favorites of the current world render as gold diamonds, always visible
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
function requestRender(delay = 90) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderReq = reqSeq++;
    send({
      type: 'render', reqId: renderReq, seed: world.seed, mc: world.mc, large: world.large, dim: world.dim,
      y: yLayer,
      highlight: highlightBiome,
      cx: view.cx, cz: view.cz, bpp: view.bpp,
      w: Math.ceil(canvas.width / dpr), h: Math.ceil(canvas.height / dpr)
    });
    requestMinimap();
    requestStructures();
  }, delay);
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
      cx: view.cx, cz: view.cz, bpp: view.bpp * MINIMAP_ZOOM_OUT,
      w: mm.width, h: mm.height
    });
  }, delay);
}
function requestStructures() {
  const active = structToggles.filter((t) => t.on);
  if (!active.length) return;
  const W = canvas.width / dpr, H = canvas.height / dpr;
  const m = 200 * view.bpp; // small margin
  send({
    type: 'structures', reqId: reqSeq++, seed: world.seed, mc: world.mc, large: world.large, dim: world.dim,
    types: active.map((t) => t.type),
    x0: Math.floor(s2wx(0) - m), z0: Math.floor(s2wz(0) - m),
    x1: Math.ceil(s2wx(W) + m), z1: Math.ceil(s2wz(H) + m)
  });
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
  else if (pointers.size === 1) { dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY; }
});
canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  hud.querySelector('.coords').textContent = `${Math.round(s2wx(mx))}, ${Math.round(s2wz(my))}`;
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
  else if (e.key === 'Escape') { if (ruler.on) { setRulerOn(false); } hidePopup(); }
  else return;
  e.preventDefault();
});

function clickAt(e) {
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
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
}
function addMainBiomeRow(biome) {
  addRow($('#mainBiomes'), [aria(biomeSelect(biome), 'ariaBiome')]);
}
function addAdjRow(biome, dist, negate) {
  const neg = critSelect([['0', t('present'), 'present'], ['1', t('absent'), 'absent']], negate ? '1' : '0');
  neg.className = 'neg';
  aria(neg, 'ariaPresence');
  addRow($('#adjClauses'), [aria(biomeSelect(biome), 'ariaBiome'), neg, subLbl('within'), aria(numInput(dist ?? 400, 0, 16), 'ariaDistance'), subLbl('blocks')]);
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
// Criteria panel -> search-message fields, or null when no main biome is set.
// Shared by the location search and the multi-seed search.
function collectCriteria() {
  const mainBiomes = rowsOf('#mainBiomes')
    .map((r) => Number.parseInt(r.querySelector('select').value, 10))
    .filter(Number.isFinite);
  if (!mainBiomes.length) return null;
  const adjClauses = rowsOf('#adjClauses').map((r) => ({
    biomes: [Number.parseInt(r.querySelector('select').value, 10)],
    dist: Number.parseInt(r.querySelector('input').value, 10) || 0,
    negate: r.querySelector('select.neg').value === '1'
  })).filter((c) => Number.isFinite(c.biomes[0]) && c.dist > 0);
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
  return {
    mainBiomes,
    adjMode: $('#adjMode').value, adjClauses,
    structMode: $('#structMode').value, structClauses, pairClauses,
    surface: surfMin !== null || surfMax !== null ? { min: surfMin, max: surfMax } : null
  };
}

function runSearch() {
  const crit = collectCriteria();
  if (!crit) {
    searchInfo.textContent = t('pickBiome');
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

// ---------- multi-seed search (worker pool) ----------
const seedPool = [];
let seedReq = 0, seedBusy = false;
let seedBatches = [], seedFoundCount = 0, seedScannedCount = 0, seedTotal = 0;
let seedMsgBase = null, seedStart = '0', seedMode = 'random';

function getSeedPool() {
  const target = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  while (seedPool.length < target) {
    const w = new Worker('./worker.js');
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
}
function startSeedSearch() {
  const crit = collectCriteria();
  const seedInfo = $('#seedInfo');
  if (!crit) {
    seedInfo.textContent = t('pickBiome');
    seedInfo.className = 'info err';
    return;
  }
  seedTotal = Math.min(SEED_SEARCH_MAX_TOTAL, Math.max(1, Number.parseInt($('#seedCount').value, 10) || 500));
  const radius = Math.min(5000, Math.max(500, Number.parseInt($('#seedRadius').value, 10) || 1500));
  // seeds are only probed: a coarse stride keeps the per-seed cost low
  const step = Math.max(32, Number.parseInt($('#step').value, 10) || 32);
  seedReq = reqSeq++;
  seedFoundCount = 0; seedScannedCount = 0;
  seedBatches = planBatches(seedTotal, 8);
  seedStart = $('#seed').value || '0';
  seedMode = $('#seedMode').value;
  seedMsgBase = {
    type: 'seedSearch', reqId: seedReq, mc: world.mc, large: world.large, dim: world.dim,
    y: yLayer, range: radius, step, ...crit
  };
  $('#seedResults').textContent = '';
  seedInfo.textContent = t('searching'); seedInfo.className = 'info busy';
  setSeedBusy(true);
  getSeedPool().forEach(dispatchSeedBatch);
}
function nextSeedBatch() {
  const b = seedBatches.shift();
  if (!b) return null;
  return seedMode === 'seq'
    ? sequentialSeeds(seedStart, b.offset, b.count)
    : randomSeeds(b.count, Math.random);
}
function dispatchSeedBatch(w) {
  const seeds = nextSeedBatch();
  if (!seeds) {
    w.idle = true;
    finishSeedSearchIfIdle();
    return;
  }
  w.idle = false;
  post(w, { ...seedMsgBase, seeds });
}
function onSeedScanned(d) {
  if (d.reqId !== seedReq) return;
  seedScannedCount++;
  $('#seedProgress').value = Math.round(100 * seedScannedCount / seedTotal);
  if (d.hit && seedFoundCount < SEED_SEARCH_MAX_FOUND) {
    seedFoundCount++;
    $('#seedResults').appendChild(seedResultRow(d.seed, d.hit));
    if (seedFoundCount >= SEED_SEARCH_MAX_FOUND) cancelSeedSearch();
  }
}
function onSeedBatchDone(w, d) {
  if (d.reqId !== seedReq) return;
  if (d.error) seedBatches = [];
  dispatchSeedBatch(w);
}
function finishSeedSearchIfIdle() {
  if (!seedBusy || !seedPool.every((w) => w.idle)) return;
  setSeedBusy(false);
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
  seedBatches = [];
  for (const w of seedPool) post(w, { type: 'cancelSeedSearch', reqId: seedReq });
}
// clicking a candidate loads the seed and centers the map on its first hit
function seedResultRow(seed, hit) {
  const li = document.createElement('button');
  li.className = 'result';
  const rx = document.createElement('span');
  rx.className = 'rx'; rx.textContent = seed;
  const rc = document.createElement('span');
  rc.className = 'rc'; rc.textContent = `${hit.x}, ${hit.z}`;
  li.append(rx, rc);
  li.onclick = () => {
    $('#seed').value = seed;
    world.seed = seed;
    view.cx = hit.x; view.cz = hit.z;
    curReset(); draw(); requestRender(0); syncHash();
  };
  return li;
}
function onSearchResult(d) {
  if (d.reqId !== searchReq) return;   // stale
  setSearchBusy(false);
  pins = d.hits; selected = -1;
  hidePopup();
  resultsEl.innerHTML = '';
  $('#exportBtns').hidden = !pins.length;
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
  selectPin(0);
}
function renderResultsList() {
  resultsEl.innerHTML = '';
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
    pins = hits; selected = -1;
    hidePopup();
    renderResultsList();
    $('#exportBtns').hidden = false;
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
    const dimName = (DIMENSIONS.find(([v]) => v === h.dim) || [0, 'Overworld'])[1];
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
    dot.className = 'dot'; dot.style.background = `rgb(${e.rgb[0]},${e.rgb[1]},${e.rgb[2]})`;
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
  const box = $('#structLayers'); box.innerHTML = '';
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
    input.onchange = (e) => { tg.on = e.target.checked; if (tg.on) requestStructures(); else { tg.points = null; draw(); } };
    box.appendChild(row);
  });
}

// Current criteria as a plain object — used by the share hash and the exports.
function readCriteria() {
  return {
    mb: rowsOf('#mainBiomes').map((r) => Number.parseInt(r.querySelector('select').value, 10)),
    am: $('#adjMode').value,
    ac: rowsOf('#adjClauses').map((r) => ({
      b: Number.parseInt(r.querySelector('select').value, 10),
      d: Number.parseInt(r.querySelector('input').value, 10) || 0,
      n: r.querySelector('select.neg').value === '1' ? 1 : 0
    })),
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

// ---------- URL hash sharing ----------
function syncHash() {
  const state = {
    s: world.seed, m: world.mc, l: world.large ? 1 : 0, d: world.dim, y: yLayer,
    x: Math.round(view.cx), z: Math.round(view.cz), b: +view.bpp.toFixed(2),
    c: readCriteria()
  };
  history.replaceState(null, '', '#' + encodeShareState(state));
}
function readHash() {
  return decodeShareState(location.hash.slice(1));
}
// Rebuild the criteria rows from a share-link-shaped `c` object. Values may
// be attacker-controlled (share links): coerce everything to integers and cap
// list sizes before building any DOM from them.
function applyCriteria(raw) {
  $('#mainBiomes').textContent = ''; $('#adjClauses').textContent = ''; $('#structClauses').textContent = '';
  $('#pairClauses').textContent = '';
  $('#surfMin').value = ''; $('#surfMax').value = '';
  const c = sanitizeCriteria(raw, MAX_CRIT_ROWS);
  if (!c) return;
  c.mb.forEach((b) => addMainBiomeRow(b));
  $('#adjMode').value = c.am;
  c.ac.forEach((r) => addAdjRow(r.b, r.d, r.n));
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
}

// ---------- init ----------
function init() {
  hashState = readHash();
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
  $('#seedSearchBtn').onclick = () => {
    if (seedBusy) cancelSeedSearch();
    else startSeedSearch();
  };
  $('#pngBtn').onclick = exportMapPNG;
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
  $('#addMainBiome').onclick = () => addMainBiomeRow();
  $('#addAdj').onclick = () => addAdjRow();
  $('#addStruct').onclick = () => addStructRow();
  $('#addPair').onclick = () => addPairRow();
  $('#shareBtn').onclick = () => {
    syncHash();
    copyText(location.href)
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
  langSel.value = currentLang;
  // dynamic rows carry data-i18n attributes, so applyI18n (via setLang) covers them
  langSel.onchange = () => { setLang(langSel.value); hidePopup(); buildFavList(); buildLegend(legendPresent); };
  $('#gridChk').onchange = (e) => { showGrid = e.target.checked; draw(); };
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
  // small screens: the criteria panel folds away so the map fills the screen
  $('#panelToggle').onclick = () => {
    const collapsed = document.body.classList.toggle('panel-collapsed');
    $('#panelToggle').setAttribute('aria-expanded', String(!collapsed));
    resize();   // the map area changed size
  };
  $('#helpBtn').onclick = () => $('#helpDlg').showModal();
  $('#helpClose').onclick = () => $('#helpDlg').close();
  buildDimSelect();
  buildFavList();
  initTheme();
  buildHistList();
  applyI18n();
  resize();
  // offline support (PWA); requires a secure context, harmless otherwise
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline mode unavailable */ });
  }
}
function curReset() { tile = null; tileCache.clear(); structToggles.forEach((tg) => tg.points = null); hidePopup(); buildFavList(); }
init();
