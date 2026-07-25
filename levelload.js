// levelload.js — reads a Minecraft Java level.dat (#320): a minimal NBT
// (Named Binary Tag) reader in pure JS, plus the format sniffing and the
// version-name mapping the "Open a save" flow needs. Everything runs on an
// in-memory buffer: the save file never leaves the machine. The gzip
// decompression itself is NOT here — the browser wrapper (app.js) uses
// DecompressionStream and the tests use node:zlib, both feeding this module
// plain uncompressed bytes.
// ES module shared between app.js and the Node test suite. No dependencies.

// NBT tag type ids (big-endian payloads, as written by Java Edition)
const TAG_END = 0;
const TAG_COMPOUND = 10;

/** @typedef {{bytes: Uint8Array, view: DataView, pos: number}} Reader */

/**
 * Sniffs what kind of file the user picked, from its first bytes.
 * - 'gzip'    : gzipped java level.dat (the normal case) — 0x1f 0x8b magic
 * - 'bedrock' : Bedrock Edition level.dat — 8-byte little-endian header
 *               (storage version, payload length) then a 0x0a compound
 * - 'nbt'     : uncompressed big-endian NBT (java level.dat saved by tools)
 * - 'invalid' : anything else
 * @param {Uint8Array} bytes raw file content
 * @returns {'gzip'|'bedrock'|'nbt'|'invalid'} detected format
 */
function detectFormat(bytes) {
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return 'gzip';
  // Bedrock header: version int32 LE (small non-zero, so bytes 1–3 are 0)
  // and the uncompressed little-endian NBT compound starting at offset 8.
  // A java uncompressed file starts 0x0a 0x00 0x00 <child tag type>, so its
  // byte 3 is non-zero for any non-empty root compound.
  if (bytes[0] !== 0 && bytes[1] === 0 && bytes[2] === 0 && bytes[3] === 0 && bytes[8] === TAG_COMPOUND) return 'bedrock';
  if (bytes[0] === TAG_COMPOUND) return 'nbt';
  return 'invalid';
}

/** @typedef {number|bigint|string|null|NbtValue[]|{[key: string]: NbtValue}} NbtValue */

/** @param {Reader} r @returns {number} */
function readByte(r) { const v = r.view.getInt8(r.pos); r.pos += 1; return v; }
/** @param {Reader} r @returns {number} */
function readShort(r) { const v = r.view.getInt16(r.pos); r.pos += 2; return v; }
/** @param {Reader} r @returns {number} */
function readInt(r) { const v = r.view.getInt32(r.pos); r.pos += 4; return v; }
// NBT longs are signed 64-bit integers: a Number would lose precision on
// large world seeds, so they are surfaced as BigInt (seed.js accepts it).
/** @param {Reader} r @returns {bigint} */
function readLong(r) { const v = r.view.getBigInt64(r.pos); r.pos += 8; return v; }
/** @param {Reader} r @returns {number} */
function readFloat(r) { const v = r.view.getFloat32(r.pos); r.pos += 4; return v; }
/** @param {Reader} r @returns {number} */
function readDouble(r) { const v = r.view.getFloat64(r.pos); r.pos += 8; return v; }
/** @param {Reader} r @returns {string} */
function readString(r) {
  const len = r.view.getUint16(r.pos); r.pos += 2;
  const s = new TextDecoder().decode(r.bytes.subarray(r.pos, r.pos + len));
  r.pos += len;
  return s;
}
// The array tags are only ever navigated past (nothing in level.dat that we
// need lives in one), so their payloads are skipped, not materialized.
/** @param {Reader} r @param {number} width bytes per element @returns {null} */
function skipArray(r, width) {
  const n = readInt(r);
  if (n < 0 || r.pos + n * width > r.bytes.length) throw new Error('truncated NBT array');
  r.pos += n * width;
  return null;
}
/** @param {Reader} r @returns {NbtValue[]} */
function readList(r) {
  const type = readByte(r);
  const n = readInt(r);
  if (n < 0) throw new Error('negative NBT list length');
  const out = [];
  for (let i = 0; i < n; i++) out.push(readPayload(r, type));
  return out;
}
/** @param {Reader} r @returns {{[key: string]: NbtValue}} */
function readCompound(r) {
  /** @type {{[key: string]: NbtValue}} */
  const obj = {};
  for (;;) {
    const type = readByte(r);
    if (type === TAG_END) return obj;
    const name = readString(r);
    obj[name] = readPayload(r, type);
  }
}
/** @type {{[type: number]: (r: Reader) => NbtValue}} */
const PAYLOAD_READERS = {
  1: readByte, 2: readShort, 3: readInt, 4: readLong, 5: readFloat, 6: readDouble,
  7: (r) => skipArray(r, 1),                 // ByteArray
  8: readString,
  9: readList,
  10: readCompound,
  11: (r) => skipArray(r, 4),                // IntArray
  12: (r) => skipArray(r, 8)                 // LongArray
};
/** @param {Reader} r @param {number} type @returns {NbtValue} */
function readPayload(r, type) {
  const fn = PAYLOAD_READERS[type];
  if (!fn) throw new Error(`unknown NBT tag type ${type}`);
  return fn(r);
}

/** @param {NbtValue} v @returns {{[key: string]: NbtValue}|null} */
function asCompound(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? v : null;
}
/** @param {{[key: string]: NbtValue}} data @returns {bigint|null} */
function extractSeed(data) {
  // modern worlds (1.16+) store the seed in the WorldGenSettings compound
  const modern = asCompound(data.WorldGenSettings)?.seed;
  if (typeof modern === 'bigint') return modern;
  // legacy worlds keep it directly under Data
  const legacy = data.RandomSeed;
  return typeof legacy === 'bigint' ? legacy : null;
}
/** @param {{[key: string]: NbtValue}} data @returns {{x: number, z: number}|null} */
function extractSpawn(data) {
  const x = data.SpawnX, z = data.SpawnZ;
  return typeof x === 'number' && typeof z === 'number' ? { x, z } : null;
}

/**
 * Parses an UNCOMPRESSED java level.dat (big-endian NBT) and extracts what
 * the app can use. Throws on anything that is not a well-formed NBT file.
 * @param {Uint8Array} bytes decompressed level.dat content
 * @returns {{seed: bigint|null, versionName: string|null, spawn: {x: number, z: number}|null}}
 */
function parseLevelData(bytes) {
  /** @type {Reader} */
  const r = { bytes, view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), pos: 0 };
  if (readByte(r) !== TAG_COMPOUND) throw new Error('not an NBT compound');
  readString(r);                              // root tag name (empty in practice)
  const data = asCompound(readCompound(r).Data);
  if (data === null) throw new Error('no Data compound');
  const versionName = asCompound(data.Version)?.Name;
  return {
    seed: extractSeed(data),
    versionName: typeof versionName === 'string' ? versionName : null,
    spawn: extractSpawn(data)
  };
}

/** @param {string|null} s @returns {[number, number, number]|null} */
function parseVersionName(s) {
  // releases only ("1.21.4"); snapshots ("24w14a") and betas don't parse
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(String(s ?? '').trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), m[3] === undefined ? 0 : Number(m[3])];
}
/** @param {[number, number, number]} a @param {[number, number, number]} b @returns {number} */
function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}
/**
 * Maps a level.dat Version.Name onto the app's supported generation versions
 * (the MC_VERSIONS table: [cubiomes enum value, label] pairs). An exact label
 * wins; otherwise the closest supported version at or below the save's one
 * (so "1.21.4" lands on "1.21.3", and a future "1.22" on the newest entry).
 * @param {string|null} name Version.Name from the save, if any
 * @param {ReadonlyArray<[number, string]>} versions supported [value, label] pairs
 * @returns {{mc: number, exact: boolean}|null} match, or null when unknown/too old
 */
function matchVersion(name, versions) {
  const exact = versions.find(([, label]) => label === name);
  if (exact) return { mc: exact[0], exact: true };
  const target = parseVersionName(name);
  if (!target) return null;
  let bestMc = -1;
  /** @type {[number, number, number]|null} */
  let bestVer = null;
  for (const [mc, label] of versions) {
    const v = parseVersionName(label);
    if (v && compareVersions(v, target) <= 0 && (bestVer === null || compareVersions(v, bestVer) > 0)) {
      bestMc = mc; bestVer = v;
    }
  }
  return bestVer === null ? null : { mc: bestMc, exact: false };
}

export { detectFormat, parseLevelData, matchVersion };
