// sharestate.js — pure logic behind the share-link hash and the criteria
// forms: base64 state (de)serialization, sanitization of attacker-controlled
// hash values, legacy-link migration and view/world coordinate transforms.
// Shared between app.js (script tag) and the Node test suite (require).
'use strict';

// btoa/atob only exist in browsers; Node (tests) falls back to Buffer.
const b64encode = typeof btoa === 'function' ? btoa : (/** @type {string} */ s) => Buffer.from(s, 'binary').toString('base64');
const b64decode = typeof atob === 'function' ? atob : (/** @type {string} */ s) => Buffer.from(s, 'base64').toString('binary');

// ---- share-hash (de)serialization ----
/**
 * @param {object} state plain JSON-serializable share state
 * @returns {string} hash payload (without the leading '#')
 */
function encodeShareState(state) {
  return b64encode(encodeURIComponent(JSON.stringify(state)));
}
/**
 * @param {string} hash payload (without the leading '#'), untrusted
 * @returns {any|null} parsed state, or null when malformed
 */
function decodeShareState(hash) {
  try { return JSON.parse(decodeURIComponent(b64decode(hash))); } catch { return null; }
}

// ---- sanitization of hash-borne values (share links are untrusted) ----
/** @param {any} v @returns {number|null} */
function intOrNull(v) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
/** @param {number} v @param {number} lo @param {number} hi @returns {number} */
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

// Legacy single-criteria share links stored the main biome as c.a.
/**
 * @param {any} c criteria in either the current or the legacy shape
 * @returns {any} criteria in the current shape
 */
function normalizeLegacyCriteria(c) {
  if (c?.a === undefined) return c;
  return {
    mb: [c.a], am: 'and',
    ac: c.ba ? [{ b: c.ba, d: c.ad }] : [],
    sm: 'and',
    sc: c.st ? [{ t: c.st, mn: c.mn, r: c.sr }] : [],
    rg: c.rg, sp: c.sp
  };
}

// Coerce an untrusted criteria object into clean integers with capped list
// sizes; every malformed clause is dropped rather than guessed at.
/**
 * @param {any} c untrusted criteria (share-link `c` shape)
 * @param {number} maxRows cap on each clause list
 * @returns {{mb: number[], am: string, ac: Array<{b: number, d: number, n: boolean}>,
 *            sm: string, sc: Array<{t: number, mn: number, r: number, im: boolean}>,
 *            pc: Array<{t1: number, t2: number, g: number, r: number}>,
 *            rg: number|null, sp: number|null, s0: number|null, s1: number|null}|null}
 *          clean criteria, or null when nothing was provided
 */
function sanitizeCriteria(c, maxRows) {
  if (!c || typeof c !== 'object') return null;
  const rows = (/** @type {any} */ v) => (Array.isArray(v) ? v : []).slice(0, maxRows);
  const mb = rows(c.mb).map(intOrNull).filter((b) => b !== null);
  const ac = rows(c.ac).map((r) => {
    const b = intOrNull(r?.b), d = intOrNull(r?.d);
    return b !== null && d !== null && d >= 0 ? { b, d, n: intOrNull(r?.n) === 1 } : null;
  }).filter(Boolean);
  const sc = rows(c.sc).map((r) => {
    const t = intOrNull(r?.t), mn = intOrNull(r?.mn), rr = intOrNull(r?.r);
    return t !== null && mn !== null && rr !== null && mn >= 0 && rr >= 0
      ? { t, mn, r: rr, im: intOrNull(r?.im) === 1 } : null;
  }).filter(Boolean);
  const pc = rows(c.pc).map((r) => {
    const t1 = intOrNull(r?.t1), t2 = intOrNull(r?.t2), g = intOrNull(r?.g), rr = intOrNull(r?.r);
    return t1 !== null && t2 !== null && g !== null && rr !== null && g >= 0 && rr >= 0
      ? { t1, t2, g, r: rr } : null;
  }).filter(Boolean);
  return {
    mb,
    am: c.am === 'or' ? 'or' : 'and', ac,
    sm: c.sm === 'or' ? 'or' : 'and', sc, pc,
    rg: intOrNull(c.rg), sp: intOrNull(c.sp),
    s0: intOrNull(c.s0), s1: intOrNull(c.s1)
  };
}

// World/view fields of a decoded hash, with every value bounds-checked.
/**
 * @param {any} h decoded hash state, untrusted
 * @returns {{seed: string, mc: number|null, large: boolean, dim: number,
 *            y: number|null, cx: number|null, cz: number|null, bpp: number|null}|null}
 */
function sanitizeWorldView(h) {
  if (!h || typeof h !== 'object') return null;
  const dim = intOrNull(h.d);
  const y = intOrNull(h.y);
  const bpp = Number(h.b);
  return {
    seed: typeof h.s === 'string' || typeof h.s === 'number' ? String(h.s) : '0',
    mc: intOrNull(h.m),
    large: !!h.l,
    dim: dim === -1 || dim === 1 ? dim : 0,
    y: y === null ? null : clamp(y, -64, 320),
    cx: intOrNull(h.x), cz: intOrNull(h.z),
    bpp: Number.isFinite(bpp) ? clamp(bpp, 0.5, 512) : null
  };
}

// ---- view <-> world coordinate transforms (bpp = blocks per pixel) ----
/**
 * @param {{cx: number, cz: number, bpp: number}} view
 * @param {number} W viewport width (px)
 * @param {number} H viewport height (px)
 * @param {number} wx world x
 * @param {number} wz world z
 * @returns {{x: number, y: number}} screen point
 */
function worldToScreen(view, W, H, wx, wz) {
  return { x: (wx - view.cx) / view.bpp + W / 2, y: (wz - view.cz) / view.bpp + H / 2 };
}
/**
 * @param {{cx: number, cz: number, bpp: number}} view
 * @param {number} W viewport width (px)
 * @param {number} H viewport height (px)
 * @param {number} px screen x
 * @param {number} py screen y
 * @returns {{x: number, z: number}} world point
 */
function screenToWorld(view, W, H, px, py) {
  return { x: view.cx + (px - W / 2) * view.bpp, z: view.cz + (py - H / 2) * view.bpp };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    encodeShareState, decodeShareState, normalizeLegacyCriteria,
    sanitizeCriteria, sanitizeWorldView, worldToScreen, screenToWorld
  };
}
