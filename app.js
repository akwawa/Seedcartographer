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
let biomeIndex = new Map();                     // id -> {name,rgb}
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
  if (d.type === 'ready') {
    workerReady = true; MC_NEWEST = d.mcNewest; world.mc = MC_NEWEST;
    send({ type: 'biomeList' });
    pending.forEach(([m, t]) => worker.postMessage(m, t || [])); pending.length = 0;
    return;
  }
  if (d.type === 'biomeList') { onBiomeList(d.list); return; }
  if (d.type === 'tile') {
    if (d.reqId !== renderReq) return;            // stale
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
}

// ---------- search ----------
function runSearch() {
  const biomeA = parseInt($('#biomeA').value, 10);
  const biomeB = $('#biomeB').value === '' ? -1 : parseInt($('#biomeB').value, 10);
  const adjDist = parseInt($('#adjDist').value, 10) || 0;
  const structType = $('#structType').value === '' ? -1 : parseInt($('#structType').value, 10);
  const minStruct = parseInt($('#minStruct').value, 10) || 0;
  const structRadius = parseInt($('#structRadius').value, 10) || 0;
  const range = parseInt($('#range').value, 10) || 4000;
  const step = parseInt($('#step').value, 10) || 48;
  searchInfo.textContent = 'Searching…'; searchInfo.className = 'info busy';
  send({
    type: 'search', reqId: reqSeq++, seed: world.seed, mc: world.mc, large: world.large,
    biomeA, biomeB, adjDist, structType, minStruct, structRadius,
    cx: Math.round(view.cx), cz: Math.round(view.cz), range, step, mergeDist: Math.max(256, step * 6)
  });
}
function onSearchResult(d) {
  pins = d.hits; selected = -1;
  resultsEl.innerHTML = '';
  if (!pins.length) {
    searchInfo.textContent = `No match within ${$('#range').value} blocks (${d.ms} ms). Widen the area or relax a criterion.`;
    searchInfo.className = 'info empty';
    draw(); return;
  }
  searchInfo.textContent = `${pins.length} location${pins.length > 1 ? 's' : ''} found · ${d.ms} ms`;
  searchInfo.className = 'info ok';
  pins.forEach((p, i) => {
    const li = document.createElement('button');
    li.className = 'result'; li.dataset.i = i;
    li.innerHTML = `<span class="rx">${p.x}, ${p.z}</span>` +
      (p.count ? `<span class="rc">${p.count} nearby</span>` : '');
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
  pop.innerHTML = `<div class="pop-x">${p.x}, ${p.z}</div>` +
    `<button class="pop-tp">Copy /tp</button>`;
  pop.querySelector('.pop-tp').onclick = () => {
    navigator.clipboard.writeText(`/tp @s ${p.x} ~ ${p.z}`);
    pop.querySelector('.pop-tp').textContent = 'Copied';
    setTimeout(() => { const b = pop.querySelector('.pop-tp'); if (b) b.textContent = 'Copy /tp'; }, 1200);
  };
  pop.style.display = 'block';
}

// ---------- biome list / dropdowns ----------
function onBiomeList(list) {
  biomeIndex = new Map(list.map((b) => [b.id, b]));
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
  const opt = (b) => `<option value="${b.id}">${b.name}</option>`;
  $('#biomeA').innerHTML = sorted.map(opt).join('');
  $('#biomeB').innerHTML = `<option value="">— none —</option>` + sorted.map(opt).join('');
  // structures
  const structDefs = [
    [0, 'Village'], [1, 'Pillager outpost'], [2, 'Desert pyramid'], [3, 'Jungle temple'],
    [4, 'Witch hut'], [5, 'Igloo'], [6, 'Ocean ruin'], [7, 'Shipwreck'], [8, 'Ocean monument'],
    [9, 'Woodland mansion'], [10, 'Ruined portal'], [11, 'Ancient city'], [12, 'Buried treasure'],
    [13, 'Trail ruins'], [14, 'Trial chamber']
  ];
  // resolve enum values via worker? structConst is in worker; we mirror indices here.
  // We asked worker for nothing; instead use a tiny round-trip-free map: request via search uses enum values.
  // Simpler: store the UI index and convert with a fixed table requested once.
  resolveStructConsts(structDefs);
}
let structDefsResolved = null;
function resolveStructConsts(defs) {
  // We need the enum values; ask the worker once through a dedicated message.
  const chan = (e) => {
    if (e.data.type !== 'structConsts') return;
    worker.removeEventListener('message', chan);
    const vals = e.data.values;
    const sel = $('#structType');
    sel.innerHTML = `<option value="">— none —</option>`;
    structToggles = [];
    defs.forEach((d, idx) => {
      const ev = vals[idx];
      sel.innerHTML += `<option value="${ev}">${d[1]}</option>`;
      structToggles.push({ type: ev, label: d[1], on: false, color: structColors[idx % structColors.length], points: null });
    });
    buildStructToggleUI();
    applyHashCriteria();
  };
  worker.addEventListener('message', chan);
  send({ type: 'structConsts', indices: defs.map((d) => d[0]) });
}
function buildStructToggleUI() {
  const box = $('#structLayers'); box.innerHTML = '';
  structToggles.forEach((t, i) => {
    const id = 'sl' + i;
    const row = document.createElement('label'); row.className = 'layer';
    row.innerHTML = `<input type="checkbox" id="${id}"><span class="dot" style="background:${t.color}"></span>${t.label}`;
    row.querySelector('input').onchange = (e) => { t.on = e.target.checked; if (t.on) requestStructures(); else { t.points = null; draw(); } };
    box.appendChild(row);
  });
}

// ---------- URL hash sharing ----------
function syncHash() {
  const state = {
    s: world.seed, m: world.mc, l: world.large ? 1 : 0,
    x: Math.round(view.cx), z: Math.round(view.cz), b: +view.bpp.toFixed(2),
    c: {
      a: $('#biomeA').value, ba: $('#biomeB').value, ad: $('#adjDist').value,
      st: $('#structType').value, mn: $('#minStruct').value, sr: $('#structRadius').value,
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
  // called once dropdowns exist; applies criteria from hash or sensible demo defaults
  const c = hashState && hashState.c;
  const set = (sel, v) => { if (v !== undefined && v !== null && $(sel).querySelector(`option[value="${v}"]`)) $(sel).value = v; };
  if (c) {
    set('#biomeA', c.a); set('#biomeB', c.ba); $('#adjDist').value = c.ad;
    set('#structType', c.st); $('#minStruct').value = c.mn; $('#structRadius').value = c.sr;
    $('#range').value = c.rg; $('#step').value = c.sp;
  } else {
    // demo: cherry grove + warm ocean + >=2 villages (matches built-in seed 141)
    set('#biomeA', 185); set('#biomeB', 44); $('#adjDist').value = 400;
    set('#structType', String(structToggles[0].type)); $('#minStruct').value = 2; $('#structRadius').value = 800;
    $('#range').value = 5000; $('#step').value = 16;
  }
}

// ---------- init ----------
function init() {
  hashState = readHash();
  if (hashState) {
    world.seed = hashState.s; world.mc = hashState.m; world.large = !!hashState.l;
    view.cx = hashState.x; view.cz = hashState.z; view.bpp = hashState.b;
  }
  $('#seed').value = world.seed;
  $('#large').checked = world.large;
  $('#loadBtn').onclick = () => {
    world.seed = $('#seed').value || '0'; world.large = $('#large').checked;
    curReset(); requestRender(0); syncHash();
  };
  $('#searchBtn').onclick = runSearch;
  $('#shareBtn').onclick = () => {
    syncHash(); navigator.clipboard.writeText(location.href);
    $('#shareBtn').textContent = 'Link copied'; setTimeout(() => $('#shareBtn').textContent = 'Share link', 1300);
  };
  resize();
}
function curReset() { tile = null; structToggles.forEach((t) => t.points = null); }
init();
