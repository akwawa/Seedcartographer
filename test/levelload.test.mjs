// levelload.js (#320): the fixtures are synthetic NBT buffers built here by
// the test itself — no binary is committed. The gzip layer is exercised with
// node:zlib, mirroring the split in the app: DecompressionStream (browser)
// or zlib (tests) inflate the file, the pure module parses the plain bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync, gunzipSync } from 'node:zlib';
import { detectFormat, parseLevelData, matchVersion } from '../levelload.js';

// ---- tiny big-endian NBT writer -------------------------------------------
const byte = (n) => Buffer.from([n]);
const i16 = (n) => { const b = Buffer.alloc(2); b.writeInt16BE(n); return b; };
const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32BE(n); return b; };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64BE(BigInt(n)); return b; };
const f32 = (n) => { const b = Buffer.alloc(4); b.writeFloatBE(n); return b; };
const f64 = (n) => { const b = Buffer.alloc(8); b.writeDoubleBE(n); return b; };
const str = (s) => { const b = Buffer.from(s, 'utf8'); return Buffer.concat([Buffer.from([b.length >> 8, b.length & 0xff]), b]); };
const tag = (type, name, payload) => Buffer.concat([byte(type), str(name), payload]);
const compound = (...children) => Buffer.concat([...children, byte(0)]);
const root = (dataChildren) => Buffer.concat([byte(10), str(''), compound(tag(10, 'Data', compound(...dataChildren)))]);

const versionTag = (name) => tag(10, 'Version', compound(tag(8, 'Name', str(name)), tag(3, 'Id', i32(4189))));
const spawnTags = (x, z) => [tag(3, 'SpawnX', i32(x)), tag(3, 'SpawnZ', i32(z))];
const modernSeed = (s) => tag(10, 'WorldGenSettings', compound(tag(4, 'seed', i64(s)), tag(1, 'bonus_chest', byte(0))));

// the supported-version table shape used by app.js (MC_VERSIONS excerpt)
const VERSIONS = [[28, '1.21'], [27, '1.21.3'], [26, '1.21.1'], [25, '1.20'], [20, '1.16'], [3, '1.0']];

// ---- parseLevelData --------------------------------------------------------
test('modern world: seed from WorldGenSettings, version and spawn', () => {
  const buf = root([modernSeed(-4291571781902767103n), versionTag('1.21.1'), ...spawnTags(-192, 848)]);
  const lvl = parseLevelData(new Uint8Array(buf));
  assert.equal(lvl.seed, -4291571781902767103n);
  assert.equal(lvl.versionName, '1.21.1');
  assert.deepEqual(lvl.spawn, { x: -192, z: 848 });
});

test('legacy world: RandomSeed fallback, no Version, no spawn', () => {
  const lvl = parseLevelData(new Uint8Array(root([tag(4, 'RandomSeed', i64(123456789n))])));
  assert.equal(lvl.seed, 123456789n);
  assert.equal(lvl.versionName, null);
  assert.equal(lvl.spawn, null);
});

test('WorldGenSettings without a Long seed falls back to RandomSeed', () => {
  const buf = root([
    tag(10, 'WorldGenSettings', compound(tag(3, 'seed', i32(7)))),
    tag(4, 'RandomSeed', i64(42n)), ...spawnTags(0, 0)
  ]);
  assert.equal(parseLevelData(new Uint8Array(buf)).seed, 42n);
});

test('no seed tag at all yields seed null', () => {
  const lvl = parseLevelData(new Uint8Array(root([tag(3, 'RandomSeed', i32(9)), ...spawnTags(4, 4)])));
  assert.equal(lvl.seed, null);
});

test('every other tag type is navigated past without being retained', () => {
  const buf = root([
    tag(1, 'aByte', byte(3)), tag(2, 'aShort', i16(-2)),
    tag(5, 'aFloat', f32(1.5)), tag(6, 'aDouble', f64(2.25)),
    tag(7, 'aByteArray', Buffer.concat([i32(3), Buffer.from([1, 2, 3])])),
    tag(11, 'anIntArray', Buffer.concat([i32(2), i32(7), i32(8)])),
    tag(12, 'aLongArray', Buffer.concat([i32(1), i64(5n)])),
    tag(9, 'aList', Buffer.concat([byte(3), i32(2), i32(1), i32(2)])),
    tag(9, 'nested', Buffer.concat([byte(10), i32(1), compound(tag(8, 's', str('é')))])),
    tag(4, 'RandomSeed', i64(-1n)), ...spawnTags(16, -16)
  ]);
  const lvl = parseLevelData(new Uint8Array(buf));
  assert.equal(lvl.seed, -1n);
  assert.deepEqual(lvl.spawn, { x: 16, z: -16 });
});

test('partial spawn (SpawnX without SpawnZ) is ignored', () => {
  const lvl = parseLevelData(new Uint8Array(root([tag(4, 'RandomSeed', i64(1n)), tag(3, 'SpawnX', i32(8))])));
  assert.equal(lvl.spawn, null);
});

test('a non-string Version.Name and a non-compound Version are ignored', () => {
  const a = root([tag(4, 'RandomSeed', i64(1n)), tag(10, 'Version', compound(tag(3, 'Name', i32(5))))]);
  assert.equal(parseLevelData(new Uint8Array(a)).versionName, null);
  const b = root([tag(4, 'RandomSeed', i64(1n)), tag(9, 'Version', Buffer.concat([byte(3), i32(1), i32(2)]))]);
  assert.equal(parseLevelData(new Uint8Array(b)).versionName, null);
});

// ---- malformed files -------------------------------------------------------
test('rejects a file whose root is not a compound', () => {
  assert.throws(() => parseLevelData(new Uint8Array([3, 0, 0, 0, 0, 0, 5])), /not an NBT compound/);
});

test('rejects a root without a Data compound (missing or wrong type)', () => {
  const missing = Buffer.concat([byte(10), str(''), compound(tag(3, 'Other', i32(1)))]);
  assert.throws(() => parseLevelData(new Uint8Array(missing)), /no Data compound/);
  const wrongType = Buffer.concat([byte(10), str(''), compound(tag(3, 'Data', i32(1)))]);
  assert.throws(() => parseLevelData(new Uint8Array(wrongType)), /no Data compound/);
  const listData = Buffer.concat([byte(10), str(''), compound(tag(9, 'Data', Buffer.concat([byte(3), i32(0)])))]);
  assert.throws(() => parseLevelData(new Uint8Array(listData)), /no Data compound/);
});

test('rejects an unknown tag type', () => {
  assert.throws(() => parseLevelData(new Uint8Array(root([tag(13, 'weird', byte(0))]))), /unknown NBT tag type 13/);
});

test('rejects negative or overflowing array and list lengths', () => {
  const negArray = root([tag(7, 'a', i32(-1))]);
  assert.throws(() => parseLevelData(new Uint8Array(negArray)), /truncated NBT array/);
  const hugeArray = root([tag(11, 'a', i32(1000))]);
  assert.throws(() => parseLevelData(new Uint8Array(hugeArray)), /truncated NBT array/);
  const negList = root([tag(9, 'l', Buffer.concat([byte(3), i32(-4)]))]);
  assert.throws(() => parseLevelData(new Uint8Array(negList)), /negative NBT list length/);
});

test('rejects a truncated buffer (DataView range error)', () => {
  const buf = root([tag(4, 'RandomSeed', i64(1n))]);
  assert.throws(() => parseLevelData(new Uint8Array(buf.subarray(0, buf.length - 6))), RangeError);
});

// ---- detectFormat ----------------------------------------------------------
test('detects a gzipped level.dat and parses it after inflation', () => {
  const plain = root([modernSeed(99n), versionTag('1.21'), ...spawnTags(0, 0)]);
  const gz = new Uint8Array(gzipSync(plain));
  assert.equal(detectFormat(gz), 'gzip');
  assert.equal(parseLevelData(new Uint8Array(gunzipSync(gz))).seed, 99n);
});

test('detects an uncompressed java level.dat', () => {
  assert.equal(detectFormat(new Uint8Array(root([tag(4, 'RandomSeed', i64(1n))]))), 'nbt');
});

test('detects a Bedrock level.dat (little-endian header)', () => {
  // storage version 10 LE, payload length LE, then the 0x0a compound
  const bedrock = new Uint8Array([10, 0, 0, 0, 12, 0, 0, 0, 10, 0, 0, 0]);
  assert.equal(detectFormat(bedrock), 'bedrock');
});

test('anything else is invalid, including near-misses of each magic', () => {
  assert.equal(detectFormat(new Uint8Array([])), 'invalid');
  assert.equal(detectFormat(new Uint8Array([0x1f, 0x00, 0, 0, 0, 0, 0, 0, 0])), 'invalid');
  assert.equal(detectFormat(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 10])), 'invalid');   // version byte 0
  assert.equal(detectFormat(new Uint8Array([9, 1, 0, 0, 0, 0, 0, 0, 10])), 'invalid');   // bytes[1] != 0
  assert.equal(detectFormat(new Uint8Array([9, 0, 1, 0, 0, 0, 0, 0, 10])), 'invalid');   // bytes[2] != 0
  assert.equal(detectFormat(new Uint8Array([9, 0, 0, 1, 0, 0, 0, 0, 10])), 'invalid');   // bytes[3] != 0
  assert.equal(detectFormat(new Uint8Array([9, 0, 0, 0, 0, 0, 0, 0, 7])), 'invalid');    // no compound at 8
});

// ---- matchVersion ----------------------------------------------------------
test('exact label match wins', () => {
  assert.deepEqual(matchVersion('1.21.1', VERSIONS), { mc: 26, exact: true });
});

test('a version between two supported ones maps to the closest lower', () => {
  assert.deepEqual(matchVersion('1.21.4', VERSIONS), { mc: 27, exact: false });
  assert.deepEqual(matchVersion('1.20.6', VERSIONS), { mc: 25, exact: false });
  assert.deepEqual(matchVersion('1.17.1', VERSIONS), { mc: 20, exact: false });
});

test('a same-number label spelled differently still matches', () => {
  assert.deepEqual(matchVersion('1.16.0', VERSIONS), { mc: 20, exact: false });
});

test('a future version maps to the newest supported one', () => {
  assert.deepEqual(matchVersion('1.22', VERSIONS), { mc: 27, exact: false });
});

test('too old, snapshots, garbage and missing names do not match', () => {
  assert.equal(matchVersion('0.9.5', VERSIONS), null);
  assert.equal(matchVersion('24w14a', VERSIONS), null);
  assert.equal(matchVersion('', VERSIONS), null);
  assert.equal(matchVersion(null, VERSIONS), null);
});

test('unparseable supported labels are skipped', () => {
  assert.equal(matchVersion('1.20', [[99, 'newest']]), null);
});
