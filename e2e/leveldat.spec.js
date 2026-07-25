// "Open a save" (#320): a synthetic gzipped level.dat built by the test is
// loaded through the hidden file input — the seed fills in, the version is
// selected, the map centers on the spawn with a temporary pin — and an
// invalid file shows the translated error message. No binary is committed:
// the NBT fixture is written here with node:zlib.
/* global rarePinAt, viewCenter */ // app.js test hooks, read via page.evaluate
import { gzipSync } from 'node:zlib';
import { test, expect, openMoreMenu } from './fixtures.js';

async function waitForApp(page) {
  await page.waitForFunction(() => document.querySelectorAll('#mcver option').length > 0);
}

// ---- tiny big-endian NBT writer (same shape as test/levelload.test.mjs) ----
const byte = (n) => Buffer.from([n]);
const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32BE(n); return b; };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64BE(n); return b; };
const str = (s) => { const b = Buffer.from(s, 'utf8'); return Buffer.concat([Buffer.from([b.length >> 8, b.length & 0xff]), b]); };
const tag = (type, name, payload) => Buffer.concat([byte(type), str(name), payload]);
const compound = (...children) => Buffer.concat([...children, byte(0)]);

function levelDat({ seed, version, x, z }) {
  const data = compound(
    tag(10, 'WorldGenSettings', compound(tag(4, 'seed', i64(seed)))),
    tag(10, 'Version', compound(tag(8, 'Name', str(version)))),
    tag(3, 'SpawnX', i32(x)), tag(3, 'SpawnZ', i32(z))
  );
  return gzipSync(Buffer.concat([byte(10), str(''), compound(tag(10, 'Data', data))]));
}

async function pickLevelDat(page, buffer) {
  await openMoreMenu(page);
  await expect(page.locator('#openSaveBtn')).toBeVisible();
  await page.setInputFiles('#levelDatFile', { name: 'level.dat', mimeType: 'application/octet-stream', buffer });
}

test('loading a level.dat fills the seed, selects the version and pins the spawn', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await pickLevelDat(page, levelDat({ seed: -4291571781902767103n, version: '1.21.1', x: -320, z: 784 }));
  await expect(page.locator('#searchInfo')).toHaveClass(/ok/);
  await expect(page.locator('#seed')).toHaveValue('-4291571781902767103');
  await expect(page.locator('#mcver')).toHaveValue('26'); // cubiomes value of 1.21.1
  // the map is centered on the spawn, with the temporary pin on it
  const state = await page.evaluate(() => ({ pin: rarePinAt(), view: viewCenter() }));
  expect(state.pin).toEqual({ x: -320, z: 784 });
  expect(state.view.x).toBe(-320);
  expect(state.view.z).toBe(784);
  await expect(page.locator('#popup')).toBeVisible();
});

test('an unknown version still loads the seed and spawn, with a warning', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  const before = await page.locator('#mcver').inputValue();
  await pickLevelDat(page, levelDat({ seed: 4242n, version: '24w14a', x: 16, z: -16 }));
  await expect(page.locator('#searchInfo')).toHaveClass(/empty/);
  await expect(page.locator('#searchInfo')).toContainText('24w14a');
  await expect(page.locator('#seed')).toHaveValue('4242');
  await expect(page.locator('#mcver')).toHaveValue(before); // version kept
});

test('an invalid file shows the translated error and changes nothing', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  const seedBefore = await page.locator('#seed').inputValue();
  await pickLevelDat(page, Buffer.from('this is not a level.dat at all'));
  await expect(page.locator('#searchInfo')).toHaveClass(/err/);
  await expect(page.locator('#searchInfo')).toContainText('level.dat');
  await expect(page.locator('#seed')).toHaveValue(seedBefore);
});

test('a Bedrock save shows its dedicated message', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  // Bedrock header: storage version int32 LE, payload length, 0x0a compound
  await pickLevelDat(page, Buffer.from([10, 0, 0, 0, 12, 0, 0, 0, 10, 0, 0, 0]));
  await expect(page.locator('#searchInfo')).toHaveClass(/err/);
  await expect(page.locator('#searchInfo')).toContainText('Bedrock');
});
