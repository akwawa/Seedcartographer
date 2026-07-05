// app.js — UI, map rendering, search orchestration. Talks to worker.js.
'use strict';

const worker = new Worker('./worker.js');
let MC_NEWEST = 28;
let workerReady = false;
const pending = [];                 // messages queued until worker is ready
let reqSeq = 1;

// ---------- DOM ----------
const $ = (s) => document.querySelector(s);
const canvas = $('#map'), ctx = canvas.getContext('2d');
const hud = $('#hud'), resultsEl = $('#results'), searchInfo = $('#searchInfo');

// ---------- state ----------
const world = { seed: '141', mc: MC_NEWEST, large: false };
const view = { cx: -392, cz: 56, bpp: 2.2 };   // bpp = blocks per pixel
let tile = null;                                // {canvas, originX, originZ, scale, cols, rows}
let pins = [];                                  // [{x,z,count}]
let selected = -1;
const structColors = ['#f2a73b','#7ee0c0','#c89bf0','#e07a7a','#7aa8e0','#d8d05a','#9ad06a','#e0a0c8'];
let structToggles = [];                         // [{type,label,on,color,points}]
let renderReq = 0, biomeProbeReq = 0;

// ---------- worker plumbing ----------
function send(msg, transfer) {
  if (!workerReady) { pending.push([msg, transfer]); return; }
  worker.postMessage(msg, transfer || []);
}
worker.onerror = (e) => console.error('WORKER ERROR:', e.message, e.filename, e.lineno);
worker.onmessageerror = (e) => console.error('WORKER MSGERROR', e);
worker.onmessage = (e) => {
  const d = e.data;
  if (d.type === 'fatal') { showFatal(d.message); return; }
  if (d.type === 'ready') {
    workerReady = true; MC_NEWEST = d.mcNewest;
    if (!Number.isInteger(world.mc) || world.mc < 1 || world.mc > MC_NEWEST) world.mc = MC_NEWEST;
    buildVersionSelect();
    send({ type: 'biomeList' });
    pending.forEach(([m, t]) => worker.postMessage(m, t || [])); pending.length = 0;
    return;
  }
  if (d.type === 'biomeList') { onBiomeList(d.list); return; }
  if (d.type === 'tile') {
    if (d.reqId !== renderReq) return;            // stale
    if (!d.ok) {
      searchInfo.textContent = t('tileFailed');
      searchInfo.className = 'info err';
      return;
    }
    const tmp = document.createElement('canvas');
    tmp.width = d.cols; tmp.height = d.rows;
    tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(d.rgba), d.cols, d.rows), 0, 0);
    tile = { canvas: tmp, originX: d.originX, originZ: d.originZ, scale: d.scale, cols: d.cols, rows: d.rows };
    draw();
    return;
  }
  if (d.type === 'structures') {
    d.groups.forEach((g) => { const t = structToggles.find((s) => s.type === g.type); if (t) t.points = g.points; });
    draw();
    return;
  }
  if (d.type === 'biome') {
    if (d.reqId !== biomeProbeReq) return;
    hud.querySelector('.biome').textContent = d.name || '—';
    return;
  }
  if (d.type === 'search') { onSearchResult(d); return; }
};

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
    try { document.execCommand('copy') ? resolve() : reject(new Error('copy rejected')); }
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
    world.mc = parseInt(sel.value, 10);
    curReset(); draw(); requestRender(0); syncHash();
  };
}

// ---------- coordinate transforms ----------
function w2sx(wx) { return (wx - view.cx) / view.bpp + canvas.width / (2 * dpr); }
function w2sy(wz) { return (wz - view.cz) / view.bpp + canvas.height / (2 * dpr); }
function s2wx(px) { return view.cx + (px - canvas.width / (2 * dpr)) * view.bpp; }
function s2wz(py) { return view.cz + (py - canvas.height / (2 * dpr)) * view.bpp; }

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
  ctx.fillStyle = '#0c1016'; ctx.fillRect(0, 0, W, H);

  if (tile) {
    const px = w2sx(tile.originX), py = w2sy(tile.originZ);
    const dw = tile.cols * tile.scale / view.bpp, dh = tile.rows * tile.scale / view.bpp;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tile.canvas, px, py, dw, dh);
  }

  // structure markers (only those in view)
  for (const t of structToggles) {
    if (!t.on || !t.points) continue;
    ctx.fillStyle = t.color; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1;
    for (const [x, z] of t.points) {
      const sx = w2sx(x), sy = w2sy(z);
      if (sx < -8 || sy < -8 || sx > W + 8 || sy > H + 8) continue;
      ctx.beginPath(); ctx.rect(sx - 3, sy - 3, 6, 6); ctx.fill(); ctx.stroke();
    }
  }

  // result pins
  pins.forEach((p, i) => {
    const sx = w2sx(p.x), sy = w2sy(p.z);
    drawPin(sx, sy, i === selected);
  });

  // center crosshair
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 2 - 7, H / 2); ctx.lineTo(W / 2 + 7, H / 2);
  ctx.moveTo(W / 2, H / 2 - 7); ctx.lineTo(W / 2, H / 2 + 7); ctx.stroke();
  ctx.restore();
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
      type: 'render', reqId: renderReq, seed: world.seed, mc: world.mc, large: world.large,
      cx: view.cx, cz: view.cz, bpp: view.bpp,
      w: Math.ceil(canvas.width / dpr), h: Math.ceil(canvas.height / dpr)
    });
    requestStructures();
  }, delay);
}
function requestStructures() {
  const active = structToggles.filter((t) => t.on);
  if (!active.length) return;
  const W = canvas.width / dpr, H = canvas.height / dpr;
  const m = 200 * view.bpp; // small margin
  send({
    type: 'structures', reqId: reqSeq++, seed: world.seed, mc: world.mc, large: world.large,
    types: active.map((t) => t.type),
    x0: Math.floor(s2wx(0) - m), z0: Math.floor(s2wz(0) - m),
    x1: Math.ceil(s2wx(W) + m), z1: Math.ceil(s2wz(H) + m)
  });
}

// ---------- pan / zoom ----------
let dragging = false, lastX = 0, lastY = 0, moved = false;
canvas.addEventListener('pointerdown', (e) => { dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  hud.querySelector('.coords').textContent = `${Math.round(s2wx(mx))}, ${Math.round(s2wz(my))}`;
  if (dragging) {
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    view.cx -= dx * view.bpp; view.cz -= dy * view.bpp;
    lastX = e.clientX; lastY = e.clientY; draw();
  } else {
    clearTimeout(probeTimer); probeTimer = setTimeout(() => probeBiome(mx, my), 120);
  }
});
canvas.addEventListener('pointerup', (e) => {
  dragging = false;
  if (!moved) clickAt(e);
  requestRender(0); syncHash();
});
let probeTimer = null;
function probeBiome(mx, my) {
  biomeProbeReq = reqSeq++;
  send({ type: 'biome', reqId: biomeProbeReq, seed: world.seed, mc: world.mc, large: world.large, x: Math.round(s2wx(mx)), z: Math.round(s2wz(my)) });
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

function clickAt(e) {
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
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
function biomeSelect(initial) {
  return critSelect(biomesSorted.map((b) => [b.id, b.name]), initial);
}
function structSelect(initial) {
  return critSelect(structToggles.map((tg) => [tg.type, t(tg.labelKey), tg.labelKey]), initial);
}
function numInput(value, min, step, cls) {
  const inp = document.createElement('input');
  inp.type = 'number'; inp.min = min; inp.step = step; inp.value = value;
  inp.className = 'num' + (cls ? ' ' + cls : '');
  return inp;
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
  addRow($('#mainBiomes'), [biomeSelect(biome)]);
}
function addAdjRow(biome, dist, negate) {
  const neg = critSelect([['0', t('present'), 'present'], ['1', t('absent'), 'absent']], negate ? '1' : '0');
  neg.className = 'neg';
  addRow($('#adjClauses'), [biomeSelect(biome), neg, subLbl('within'), numInput(dist ?? 400, 0, 16), subLbl('blocks')]);
}
function addStructRow(type, min, radius) {
  addRow($('#structClauses'), [structSelect(type), subLbl('atLeast'), numInput(min ?? 1, 0, 1, 'sm'), subLbl('within'), numInput(radius ?? 800, 0, 50), subLbl('blocks')]);
}
function rowsOf(sel) { return [...$(sel).querySelectorAll('.row')]; }

// ---------- search ----------
function runSearch() {
  const mainBiomes = rowsOf('#mainBiomes')
    .map((r) => parseInt(r.querySelector('select').value, 10))
    .filter(Number.isFinite);
  if (!mainBiomes.length) {
    searchInfo.textContent = t('pickBiome');
    searchInfo.className = 'info err';
    return;
  }
  const adjClauses = rowsOf('#adjClauses').map((r) => ({
    biomes: [parseInt(r.querySelector('select').value, 10)],
    dist: parseInt(r.querySelector('input').value, 10) || 0,
    negate: r.querySelector('select.neg').value === '1'
  })).filter((c) => Number.isFinite(c.biomes[0]) && c.dist > 0);
  const structClauses = rowsOf('#structClauses').map((r) => {
    const ins = r.querySelectorAll('input');
    return {
      type: parseInt(r.querySelector('select').value, 10),
      min: parseInt(ins[0].value, 10) || 0,
      radius: parseInt(ins[1].value, 10) || 0
    };
  }).filter((c) => Number.isFinite(c.type) && c.min > 0 && c.radius > 0);
  const range = parseInt($('#range').value, 10) || 4000;
  const step = parseInt($('#step').value, 10) || 48;
  searchInfo.textContent = t('searching'); searchInfo.className = 'info busy';
  send({
    type: 'search', reqId: reqSeq++, seed: world.seed, mc: world.mc, large: world.large,
    mainBiomes,
    adjMode: $('#adjMode').value, adjClauses,
    structMode: $('#structMode').value, structClauses,
    cx: Math.round(view.cx), cz: Math.round(view.cz), range, step, mergeDist: Math.max(256, step * 6)
  });
}
function onSearchResult(d) {
  pins = d.hits; selected = -1;
  hidePopup();
  resultsEl.innerHTML = '';
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
  selectPin(0);
}
function selectPin(i) {
  selected = i;
  const p = pins[i]; if (!p) return;
  view.cx = p.x; view.cz = p.z;
  if (view.bpp > 4) view.bpp = 3;
  [...resultsEl.children].forEach((c) => c.classList.toggle('sel', +c.dataset.i === i));
  draw(); requestRender(0); syncHash(); showPopup(p);
}
function showPopup(p) {
  const pop = $('#popup');
  pop.textContent = '';
  const xEl = document.createElement('div');
  xEl.className = 'pop-x'; xEl.textContent = `${p.x}, ${p.z}`;
  const btn = document.createElement('button');
  btn.className = 'pop-tp'; btn.textContent = t('copyTp');
  btn.onclick = () => {
    copyText(`/tp @s ${p.x} ~ ${p.z}`)
      .then(() => { btn.textContent = t('copied'); })
      .catch(() => { btn.textContent = t('copyFailed'); });
    setTimeout(() => { btn.textContent = t('copyTp'); }, 1200);
  };
  const close = document.createElement('button');
  close.className = 'pop-close'; close.textContent = '×';
  close.title = t('close');
  close.onclick = hidePopup;
  pop.append(close, xEl, btn);
  pop.style.display = 'block';
}
function hidePopup() {
  if (selected !== -1) {
    selected = -1;
    [...resultsEl.children].forEach((c) => c.classList.remove('sel'));
    draw();
  }
  $('#popup').style.display = 'none';
}

// ---------- biome list / dropdowns ----------
function onBiomeList(list) {
  biomesSorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
  // structures: stable engine index -> i18n label key
  const structDefs = [
    [0, 'structVillage'], [1, 'structOutpost'], [2, 'structDesertPyramid'], [3, 'structJungleTemple'],
    [4, 'structWitchHut'], [5, 'structIgloo'], [6, 'structOceanRuin'], [7, 'structShipwreck'],
    [8, 'structMonument'], [9, 'structMansion'], [10, 'structRuinedPortal'], [11, 'structAncientCity'],
    [12, 'structBuriedTreasure'], [13, 'structTrailRuins'], [14, 'structTrialChamber']
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
      structToggles.push({ type: vals[idx], labelKey: d[1], on: false, color: structColors[idx % structColors.length], points: null });
    });
    buildStructToggleUI();
    applyHashCriteria();
  };
  worker.addEventListener('message', chan);
  send({ type: 'structConsts', indices: defs.map((d) => d[0]) });
}
function buildStructToggleUI() {
  const box = $('#structLayers'); box.innerHTML = '';
  structToggles.forEach((tg, i) => {
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

// ---------- URL hash sharing ----------
function syncHash() {
  const state = {
    s: world.seed, m: world.mc, l: world.large ? 1 : 0,
    x: Math.round(view.cx), z: Math.round(view.cz), b: +view.bpp.toFixed(2),
    c: {
      mb: rowsOf('#mainBiomes').map((r) => parseInt(r.querySelector('select').value, 10)),
      am: $('#adjMode').value,
      ac: rowsOf('#adjClauses').map((r) => ({
        b: parseInt(r.querySelector('select').value, 10),
        d: parseInt(r.querySelector('input').value, 10) || 0,
        n: r.querySelector('select.neg').value === '1' ? 1 : 0
      })),
      sm: $('#structMode').value,
      sc: rowsOf('#structClauses').map((r) => {
        const ins = r.querySelectorAll('input');
        return {
          t: parseInt(r.querySelector('select').value, 10),
          mn: parseInt(ins[0].value, 10) || 0,
          r: parseInt(ins[1].value, 10) || 0
        };
      }),
      rg: $('#range').value, sp: $('#step').value
    }
  };
  history.replaceState(null, '', '#' + btoa(encodeURIComponent(JSON.stringify(state))));
}
function readHash() {
  try { return JSON.parse(decodeURIComponent(atob(location.hash.slice(1)))); } catch { return null; }
}
let hashState = null;
function applyHashCriteria() {
  // called once biome/structure lists exist; builds the criteria rows from
  // the hash, or falls back to sensible demo defaults
  let c = hashState && hashState.c;
  // legacy single-criteria share links (c.a = main biome id)
  if (c && c.a !== undefined) {
    c = {
      mb: [c.a], am: 'and',
      ac: c.ba ? [{ b: c.ba, d: c.ad }] : [],
      sm: 'and',
      sc: c.st ? [{ t: c.st, mn: c.mn, r: c.sr }] : [],
      rg: c.rg, sp: c.sp
    };
  }
  // Hash values are attacker-controlled (share links): coerce everything to
  // integers and cap list sizes before building any DOM from them.
  const int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
  const rows = (v) => (Array.isArray(v) ? v : []).slice(0, MAX_CRIT_ROWS);
  $('#mainBiomes').textContent = ''; $('#adjClauses').textContent = ''; $('#structClauses').textContent = '';
  if (c) {
    rows(c.mb).forEach((b) => { b = int(b); if (b !== null) addMainBiomeRow(b); });
    $('#adjMode').value = c.am === 'or' ? 'or' : 'and';
    rows(c.ac).forEach((r) => {
      const b = int(r && r.b), d = int(r && r.d);
      if (b !== null && d !== null && d >= 0) addAdjRow(b, d, int(r && r.n) === 1);
    });
    $('#structMode').value = c.sm === 'or' ? 'or' : 'and';
    rows(c.sc).forEach((r) => {
      const ty = int(r && r.t), mn = int(r && r.mn), rr = int(r && r.r);
      if (ty !== null && mn !== null && rr !== null && mn >= 0 && rr >= 0) addStructRow(ty, mn, rr);
    });
    const rg = int(c.rg), sp = int(c.sp);
    if (rg !== null) $('#range').value = rg;
    if (sp !== null) $('#step').value = sp;
  }
  if (!rowsOf('#mainBiomes').length) {
    // demo: cherry grove + warm ocean + >=2 villages (matches built-in seed 141)
    addMainBiomeRow(185); addAdjRow(44, 400); addStructRow(structToggles[0].type, 2, 800);
    if (!c) { $('#range').value = 5000; $('#step').value = 16; }
  }
}

// ---------- init ----------
function init() {
  hashState = readHash();
  if (hashState) {
    world.seed = hashState.s;
    world.mc = Number.isInteger(hashState.m) ? hashState.m : parseInt(hashState.m, 10);
    world.large = !!hashState.l;
    view.cx = hashState.x; view.cz = hashState.z; view.bpp = hashState.b;
  }
  $('#seed').value = world.seed;
  $('#large').checked = world.large;
  $('#loadBtn').onclick = () => {
    world.seed = $('#seed').value || '0'; world.large = $('#large').checked;
    curReset(); requestRender(0); syncHash();
  };
  $('#searchBtn').onclick = runSearch;
  $('#addMainBiome').onclick = () => addMainBiomeRow();
  $('#addAdj').onclick = () => addAdjRow();
  $('#addStruct').onclick = () => addStructRow();
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
  langSel.onchange = () => { setLang(langSel.value); hidePopup(); };
  applyI18n();
  resize();
}
function curReset() { tile = null; structToggles.forEach((tg) => tg.points = null); hidePopup(); }
init();
