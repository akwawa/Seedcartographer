'use strict';
const { test, expect } = require('@playwright/test');

// surface page errors in the CI log — a boot failure is invisible otherwise
test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
});

// The demo state (seed 141, cherry grove + warm ocean + 2 villages) loads by
// default; the biome dropdowns are only populated once the WASM engine is up.
async function waitForApp(page) {
  await page.waitForFunction(() => document.querySelectorAll('#mainBiomes .row select option').length > 0);
}
async function waitForSearchDone(page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#searchInfo');
    return el.textContent.length > 0 && !el.classList.contains('busy');
  }, { timeout: 90000 });
}

test('app boots: engine ready, map rendered, demo criteria populated', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await expect(page.locator('#mainBiomes .row')).toHaveCount(1);
  await expect(page.locator('#adjClauses .row')).toHaveCount(1);
  await expect(page.locator('#structClauses .row')).toHaveCount(1);
  // the canvas received a biome tile (not the flat background)
  await page.waitForFunction(() => {
    const c = document.querySelector('#map');
    const d = c.getContext('2d').getImageData(0, 0, c.width, 1).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] !== 12 || d[i + 1] !== 16 || d[i + 2] !== 22) return true;
    return false;
  });
});

test('demo search finds the seed-141 spot and shows the popup', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveClass(/ok/);
  await expect(page.locator('#results .result').first()).toBeVisible();
  await expect(page.locator('#popup')).toBeVisible();
  await expect(page.locator('.pop-conv')).toHaveText(/Nether ≈ -?\d+, -?\d+/);
  await expect(page.locator('#exportBtns')).toBeVisible();
  // popup closes with the × button
  await page.click('.pop-close');
  await expect(page.locator('#popup')).toBeHidden();
});

test('a long search shows progress and can be cancelled', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.fill('#range', '60000');   // big but valid area: takes a while
  await page.click('#searchBtn');
  // button flips to Cancel and the progress bar appears
  await expect(page.locator('#searchProgress')).toBeVisible();
  await expect(page.locator('#searchBtn')).toHaveText(/Cancel/);
  // wait for some progress, then cancel
  await page.waitForFunction(() => parseInt(document.querySelector('#searchProgressBar').style.width, 10) > 0, { timeout: 60000 });
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveText(/cancelled/i);
  await expect(page.locator('#searchBtn')).toHaveText(/Search this area/);
  // a fresh normal search still works after cancelling
  await page.fill('#range', '5000');
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveClass(/ok/);
});

test('oversized search radius reports an error, not "no match"', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.fill('#range', '900000');
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveClass(/err/);
});

test('share link restores seed, criteria and modes', async ({ page, context }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.click('#addMainBiome');
  await page.selectOption('#structMode', 'or');
  const url = await page.evaluate(() => { syncHash(); return location.href; });
  const p2 = await context.newPage();
  await p2.goto(url);
  await waitForApp(p2);
  await expect(p2.locator('#mainBiomes .row')).toHaveCount(2);
  await expect(p2.locator('#structMode')).toHaveValue('or');
});

test('language switch translates UI and biome names live', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.selectOption('#langSel', 'fr');
  await expect(page.locator('#searchBtn')).toHaveText('Chercher dans cette zone');
  await expect(page.locator('#mainBiomes .row select option:checked')).toHaveText('Bosquet de cerisiers');
  await page.selectOption('#langSel', 'de');
  await expect(page.locator('#mainBiomes .row select option:checked')).toHaveText('Kirschhain');
  await page.selectOption('#langSel', 'it');
  await expect(page.locator('#searchBtn')).toHaveText('Cerca in questa area');
  await expect(page.locator('#mainBiomes .row select option:checked')).toHaveText('Bosco di ciliegi');
  await page.selectOption('#langSel', 'pt');
  await expect(page.locator('#searchBtn')).toHaveText('Buscar nesta área');
  await expect(page.locator('#mainBiomes .row select option:checked')).toHaveText('Bosque de cerejeiras');
});

test('Nether dimension: biome list, map, search and share link work', async ({ page, context }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.selectOption('#dimSel', '-1');
  // biome rows now only offer the five Nether biomes
  await page.waitForFunction(() => document.querySelectorAll('#mainBiomes .row select option').length === 5);
  // structure criteria only offer Nether structures
  await page.click('#addStruct');
  await expect(page.locator('#structClauses .row select option')).toHaveCount(3);
  await page.click('#structClauses .row .rm');
  // search for a crimson forest nearby
  await page.$eval('#mainBiomes .row select', (s) => {
    s.value = [...s.options].find((o) => o.dataset.biome === 'crimson_forest').value;
  });
  await page.fill('#range', '3000');
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveClass(/ok/);
  // share link restores the dimension
  const url = await page.evaluate(() => { syncHash(); return location.href; });
  const p2 = await context.newPage();
  await p2.goto(url);
  await waitForApp(p2);
  await expect(p2.locator('#dimSel')).toHaveValue('-1');
  await expect(p2.locator('#mainBiomes .row select option:checked')).toHaveText(/Crimson|carmin/i);
});

test('slime chunks: map layer plus search criterion (Overworld only)', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  // demo criteria + "at least 1 slime chunk within 200 blocks" still matches
  await page.$eval('#structClauses .row select', (s) => {
    s.value = [...s.options].find((o) => o.textContent === 'Slime chunks').value;
  });
  const nums = page.locator('#structClauses .row input');
  await nums.nth(0).fill('1');
  await nums.nth(1).fill('200');
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveClass(/ok/);
  // the layer toggle is offered in the Overworld…
  const slimeLayer = page.locator('#structLayers .layer', { hasText: 'Slime chunks' });
  await expect(slimeLayer).toHaveCount(1);
  await slimeLayer.locator('input').check();
  // …and disappears in the Nether (slime chunks are Overworld-only)
  await page.selectOption('#dimSel', '-1');
  await expect(page.locator('#structLayers .layer', { hasText: 'Slime chunks' })).toHaveCount(0);
});

test('a preset loads its criteria and search succeeds', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.selectOption('#presetSel', 'village-outpost');
  await expect(page.locator('#mainBiomes .row')).toHaveCount(5);
  await expect(page.locator('#adjClauses .row')).toHaveCount(0);
  await expect(page.locator('#structClauses .row')).toHaveCount(2);
  await expect(page.locator('#range')).toHaveValue('5000');
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  // the picker resets when the dimension changes (criteria no longer match)
  await page.selectOption('#dimSel', '-1');
  await expect(page.locator('#presetSel')).toHaveValue('');
});

test('favorites: pin from the popup, note persists across reload, remove', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await expect(page.locator('#favList .fav')).toHaveCount(0);
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#popup')).toBeVisible();
  // pin the selected result
  await page.click('.pop-fav');
  await expect(page.locator('.pop-fav')).toHaveText('★');
  await expect(page.locator('#favList .fav')).toHaveCount(1);
  // annotate, then reload: the favorite and its note survive
  await page.fill('#favList .fav-note', 'spawn base');
  await page.locator('#favList .fav-note').blur();
  await page.reload();
  await waitForApp(page);
  await expect(page.locator('#favList .fav')).toHaveCount(1);
  await expect(page.locator('#favList .fav-note')).toHaveValue('spawn base');
  // favorites are per-dimension: none listed in the Nether
  await page.selectOption('#dimSel', '-1');
  await expect(page.locator('#favList .fav')).toHaveCount(0);
  await page.selectOption('#dimSel', '0');
  // remove it
  await page.click('#favList .fav .rm');
  await expect(page.locator('#favList .fav')).toHaveCount(0);
});

test('legend lists visible biomes and hovering an entry dims the map', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  // wait for a rendered tile, then open the legend
  await page.waitForFunction(() => document.querySelectorAll('#legendList .lg').length > 0);
  await page.click('#legend summary');
  const entries = page.locator('#legendList .lg');
  const n = await entries.count();
  expect(n).toBeGreaterThan(1);
  // snapshot the canvas, hover a legend entry: the highlight re-render changes pixels
  const before = await page.evaluate(() => {
    const c = document.querySelector('#map');
    return c.getContext('2d').getImageData(0, 0, c.width, 1).data.join(',');
  });
  await entries.first().hover();
  await page.waitForFunction((prev) => {
    const c = document.querySelector('#map');
    return c.getContext('2d').getImageData(0, 0, c.width, 1).data.join(',') !== prev;
  }, before, { timeout: 15000 });
  // language switch retranslates the legend labels in place
  await page.selectOption('#langSel', 'fr');
  await expect(page.locator('#legend summary')).toHaveText('Légende');
});

test('Export PNG downloads a snapshot of the current view', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  // wait for a rendered tile so the snapshot has content
  await page.waitForFunction(() => document.querySelectorAll('#legendList .lg').length > 0);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#pngBtn')
  ]);
  expect(download.suggestedFilename()).toBe('seedcartographer-141-map.png');
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  const buf = Buffer.concat(chunks);
  // PNG magic bytes and a non-trivial payload
  expect(buf.subarray(0, 4).toString('hex')).toBe('89504e47');
  expect(buf.length).toBeGreaterThan(1000);
});

test('Import CSV shows places as pins in the list and on the map', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.locator('#importFile').setInputFiles({
    name: 'places.csv', mimeType: 'text/csv',
    buffer: Buffer.from('x,z,nearby_structures\n-384,0,2\n100,200\n')
  });
  await expect(page.locator('#searchInfo')).toHaveText(/2/);
  await expect(page.locator('#results .result')).toHaveCount(2);
  await expect(page.locator('#popup')).toBeVisible();
  await expect(page.locator('#exportBtns')).toBeVisible();
  // a CSV with no valid rows reports an error
  await page.locator('#importFile').setInputFiles({
    name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('x,z\nfoo,bar\n')
  });
  await expect(page.locator('#searchInfo')).toHaveClass(/err/);
});

test('theme toggle switches to light, updates theme-color and persists', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  // dark by default (headless prefers dark is not guaranteed; force via toggle)
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.click('#themeBtn');
  const flipped = theme === 'dark' ? 'light' : 'dark';
  await expect(page.locator('html')).toHaveAttribute('data-theme', flipped);
  const metaColor = await page.getAttribute('meta[name="theme-color"]', 'content');
  expect(metaColor).toBe(flipped === 'light' ? '#eef1f5' : '#0c1016');
  // the choice survives a reload
  await page.reload();
  await waitForApp(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', flipped);
});

test('help dialog opens, is translated live and closes', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.click('#helpBtn');
  await expect(page.locator('#helpDlg')).toBeVisible();
  await expect(page.locator('#helpDlg h2')).toHaveText('Help');
  await page.selectOption('#langSel', 'fr');
  await expect(page.locator('#helpDlg h2')).toHaveText('Aide');
  await page.click('#helpClose');
  await expect(page.locator('#helpDlg')).toBeHidden();
});

test('spawn and strongholds: layers plus distance-to-spawn criterion', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  // both layers offered in the Overworld only
  for (const label of ['World spawn', 'Stronghold']) {
    await expect(page.locator('#structLayers .layer', { hasText: label })).toHaveCount(1);
  }
  await page.locator('#structLayers .layer', { hasText: 'World spawn' }).locator('input').check();
  await page.locator('#structLayers .layer', { hasText: 'Stronghold' }).locator('input').check();
  // demo criteria + "within 5000 blocks of the world spawn" still matches seed 141
  await page.$eval('#structClauses .row select', (s) => {
    s.value = [...s.options].find((o) => o.textContent === 'World spawn').value;
  });
  const nums = page.locator('#structClauses .row input');
  await nums.nth(0).fill('1');
  await nums.nth(1).fill('5000');
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveClass(/ok/);
  await page.selectOption('#dimSel', '-1');
  await expect(page.locator('#structLayers .layer', { hasText: 'World spawn' })).toHaveCount(0);
});

test('tiles keep rendering while a long search runs on its own worker', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.fill('#range', '60000');
  await page.click('#searchBtn');
  await page.waitForFunction(() => parseInt(document.querySelector('#searchProgressBar').style.width, 10) > 0, { timeout: 60000 });
  // zoom out: a fresh tile must arrive while the search is still running
  const before = await page.evaluate(() => {
    const c = document.querySelector('#map');
    return c.getContext('2d').getImageData(0, 0, c.width, 1).data.join(',');
  });
  await page.mouse.move(400, 300);
  await page.mouse.wheel(0, 1200);
  await page.waitForFunction((prev) => {
    const c = document.querySelector('#map');
    return c.getContext('2d').getImageData(0, 0, c.width, 1).data.join(',') !== prev;
  }, before, { timeout: 15000 });
  // the search is genuinely still in flight
  await expect(page.locator('#searchBtn')).toHaveText(/Cancel/);
  await page.click('#searchBtn');   // cancel to end quickly
  await waitForSearchDone(page);
});

test('forged hash values are ignored without breaking the app', async ({ page }) => {
  const forged = Buffer.from(encodeURIComponent(JSON.stringify({
    s: '141', m: 'evil', l: 0, x: 0, z: 0, b: 2,
    c: { mb: ['<img>', 185], am: 'evil', ac: [{ b: 'x', d: 'y' }], sm: {}, sc: 'nope', rg: 'zz', sp: null }
  }))).toString('base64');
  await page.goto('/#' + forged);
  await waitForApp(page);
  await expect(page.locator('#mainBiomes .row')).toHaveCount(1);
  await expect(page.locator('#adjMode')).toHaveValue('and');
  // invalid version falls back to the newest
  await expect(page.locator('#mcver option:checked')).toHaveText('1.21');
});
