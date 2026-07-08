// sharestate.js — pure logic behind the share-link hash and the criteria
// forms: base64 state (de)serialization, sanitization of attacker-controlled
// hash values, legacy-link migration and view/world coordinate transforms.
// Shared between app.js (script tag) and the Node test suite (require).
'use strict';

// btoa/atob exist in browsers AND in Node >= 16 (the test runtime), so the
// Buffer fallback only runs on exotic runtimes: excluded from coverage.
/* node:coverage ignore next 2 */
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
 * @returns {{mb: number[], am: string, ac: Array<{b: number, d: number, n: boolean, yl: number|null}>,
 *            qm: string, qc: Array<{b: number, p: number, d: number}>,
 *            hm: string, hc: Array<{k: string, a: number[], b: number[], mx: number}>,
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
    if (b === null || d === null || d < 0) return null;
    // optional per-clause altitude, clamped to the world's build range
    const yl = intOrNull(r?.yl);
    return { b, d, n: intOrNull(r?.n) === 1, yl: yl === null ? null : clamp(yl, -64, 320) };
  }).filter(Boolean);
  const sc = rows(c.sc).map((r) => {
    const t = intOrNull(r?.t), mn = intOrNull(r?.mn), rr = intOrNull(r?.r);
    return t !== null && mn !== null && rr !== null && mn >= 0 && rr >= 0
      ? { t, mn, r: rr, im: intOrNull(r?.im) === 1 } : null;
  }).filter(Boolean);
  const qc = rows(c.qc).map((r) => {
    const b = intOrNull(r?.b), p = intOrNull(r?.p), d = intOrNull(r?.d);
    return b !== null && p !== null && d !== null && p >= 1 && p <= 100 && d > 0
      ? { b, p, d } : null;
  }).filter(Boolean);
  const SHAPE_KINDS_HASH = new Set(['island', 'lagoon', 'enclave']);
  const hc = rows(c.hc).map((r) => {
    if (!r || typeof r !== 'object' || !SHAPE_KINDS_HASH.has(r.k)) return null;
    const mx = intOrNull(r.mx);
    if (mx === null || mx <= 0) return null;
    const ids = (/** @type {any} */ v) => (Array.isArray(v) ? v : []).slice(0, 8).map(intOrNull).filter((n) => n !== null);
    const a = ids(r.a), b = ids(r.b);
    if (r.k === 'enclave' && (!a.length || !b.length)) return null;
    return { k: r.k, a, b, mx: clamp(mx, 16, 4000) };
  }).filter(Boolean);
  const pc = rows(c.pc).map((r) => {
    const t1 = intOrNull(r?.t1), t2 = intOrNull(r?.t2), g = intOrNull(r?.g), rr = intOrNull(r?.r);
    return t1 !== null && t2 !== null && g !== null && rr !== null && g >= 0 && rr >= 0
      ? { t1, t2, g, r: rr } : null;
  }).filter(Boolean);
  return {
    mb,
    am: c.am === 'or' ? 'or' : 'and', ac,
    qm: c.qm === 'or' ? 'or' : 'and', qc,
    hm: c.hm === 'or' ? 'or' : 'and', hc,
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

// ---- compressed share links (deflate via CompressionStream) ----
// New links carry 'z.' + base64(deflate-raw(JSON)); the prefix cannot appear
// in a legacy hash ('.' is outside the base64 alphabet), so old uncompressed
// links keep decoding through the legacy path forever.
const SHARE_COMPRESSED_PREFIX = 'z.';

/** @param {Uint8Array} bytes @returns {string} base64 */
function bytesToB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCodePoint(...bytes.subarray(i, i + 0x8000));
  }
  return b64encode(bin);
}
/** @param {string} b64 @returns {Uint8Array<ArrayBuffer>} */
function b64ToBytes(b64) {
  const bin = b64decode(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = /** @type {number} */ (bin.codePointAt(i));
  return out;
}
/** @param {BufferSource} bytes @param {any} stream transform to pipe through @returns {Promise<Uint8Array>} */
async function pipeBytes(bytes, stream) {
  const out = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}

// Compressed when the runtime supports it, byte-identical to the legacy
// format otherwise — the link stays shareable either way.
/**
 * @param {object} state plain JSON-serializable share state
 * @returns {Promise<string>} hash payload (without the leading '#')
 */
async function encodeShareHash(state) {
  const CS = /** @type {any} */ (globalThis).CompressionStream;
  if (typeof CS !== 'function') return encodeShareState(state);
  const raw = new TextEncoder().encode(JSON.stringify(state));
  return SHARE_COMPRESSED_PREFIX + bytesToB64(await pipeBytes(raw, new CS('deflate-raw')));
}
/**
 * @param {string} hash payload (without the leading '#'), untrusted
 * @returns {Promise<any|null>} parsed state, or null when malformed
 */
async function decodeShareHash(hash) {
  const h = String(hash ?? '');
  if (!h.startsWith(SHARE_COMPRESSED_PREFIX)) return decodeShareState(h);
  const DS = /** @type {any} */ (globalThis).DecompressionStream;
  if (typeof DS !== 'function') return null;
  try {
    const raw = await pipeBytes(b64ToBytes(h.slice(SHARE_COMPRESSED_PREFIX.length)), new DS('deflate-raw'));
    return JSON.parse(new TextDecoder().decode(raw));
  } catch { return null; }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    encodeShareState, decodeShareState, encodeShareHash, decodeShareHash, normalizeLegacyCriteria,
    sanitizeCriteria, sanitizeWorldView, worldToScreen, screenToWorld
  };
}
