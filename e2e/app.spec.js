/* global ruler */ // top-level lexical binding of app.js, read via page.evaluate
import { test, expect } from './fixtures.js';

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

test('structures-only search: "any biome" + villages, then share-link restore', async ({ page, context }) => {
  await page.goto('/');
  await waitForApp(page);
  // demo criteria load: flip the main biome to "any biome" and drop the
  // adjacency clause so only the structure criterion (2 villages) remains
  await page.selectOption('#mainBiomes .row select', '-1');
  await page.click('#adjClauses .row .rm');
  await expect(page.locator('#adjClauses .row')).toHaveCount(0);
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveClass(/ok/);
  await expect(page.locator('#results .result').first()).toBeVisible();
  // the share link keeps the structures-only criteria
  const url = await page.evaluate(async () => { await syncHash(); return location.href; });
  const p2 = await context.newPage();
  await p2.goto(url);
  await waitForApp(p2);
  await expect(p2.locator('#mainBiomes .row select')).toHaveValue('-1');
  await expect(p2.locator('#adjClauses .row')).toHaveCount(0);
  await expect(p2.locator('#structClauses .row')).toHaveCount(1);
  // the restored criteria still search fine
  await p2.click('#searchBtn');
  await waitForSearchDone(p2);
  await expect(p2.locator('#searchInfo')).toHaveClass(/ok/);
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
  await page.waitForFunction(() => document.querySelector('#searchProgress').value > 0, { timeout: 60000 });
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
  const url = await page.evaluate(async () => { await syncHash(); return location.href; });
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
  await page.selectOption('#langSel', 'ja');
  await expect(page.locator('#searchBtn')).toHaveText('このエリアを検索');
  await expect(page.locator('#mainBiomes .row select option:checked')).toHaveText('桜の森');
  await page.selectOption('#langSel', 'ru');
  await expect(page.locator('#searchBtn')).toHaveText('Искать в этой области');
  await expect(page.locator('#mainBiomes .row select option:checked')).toHaveText('Вишнёвая роща');
  await page.selectOption('#langSel', 'pl');
  await expect(page.locator('#searchBtn')).toHaveText('Przeszukaj ten obszar');
  await expect(page.locator('#mainBiomes .row select option:checked')).toHaveText('Wiśniowy gaj');
  await page.selectOption('#langSel', 'zh-CN');
  await expect(page.locator('#searchBtn')).toHaveText('搜索此区域');
  await expect(page.locator('#mainBiomes .row select option:checked')).toHaveText('樱花树林');
  // long labels (ru/pl) and ideograms must not overflow the panel horizontally
  // long labels (ru/pl) and ideograms must not push the layout further than
  // the widest pre-existing locale already does (the topbar overflows and is
  // clipped by design at some widths, in every language)
  const overflowOf = async (lang) => {
    await page.selectOption('#langSel', lang);
    return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  };
  let baseline = 0;
  for (const lang of ['en', 'fr', 'es', 'de', 'it', 'pt']) baseline = Math.max(baseline, await overflowOf(lang));
  for (const lang of ['ja', 'ru', 'pl', 'zh-CN']) {
    expect(await overflowOf(lang), `layout overflow in ${lang}`).toBeLessThanOrEqual(baseline);
  }
});

test('Nether dimension: biome list, map, search and share link work', async ({ page, context }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.selectOption('#dimSel', '-1');
  // biome rows now only offer the five Nether biomes (plus "any biome")
  await page.waitForFunction(() => document.querySelectorAll('#mainBiomes .row select option').length === 6);
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
  const url = await page.evaluate(async () => { await syncHash(); return location.href; });
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
  // the deployed-build stamp is filled in (dev placeholder when served raw)
  await expect(page.locator('#helpVersion')).toHaveText(/^v/);
  // the credits disclose the anonymous Umami usage statistics
  await expect(page.locator('#helpDlg')).toContainText('Umami');
  await page.selectOption('#langSel', 'fr');
  await expect(page.locator('#helpDlg h2')).toHaveText('Aide');
  await page.click('#helpClose');
  await expect(page.locator('#helpDlg')).toBeHidden();
});

test('gallery modal: thumbnail cards, clicking one applies the entry', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.click('#galleryBtn');
  await expect(page.locator('#galleryDlg')).toBeVisible();
  const cards = page.locator('#galleryCards .gallerycard');
  await expect(cards).toHaveCount(4);
  await expect(cards.first().locator('canvas.gallerythumb')).toBeVisible();
  // the second entry (slime farm at 160,-3952) recenters the map and closes
  await cards.nth(1).click();
  await expect(page.locator('#galleryDlg')).toBeHidden();
  await expect(page.locator('#seed')).toHaveValue('141');
  await expect.poll(() => page.evaluate(
    async () => (await decodeShareHash(location.hash.slice(1)))?.x
  )).toBe(160);
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
  await page.waitForFunction(() => document.querySelector('#searchProgress').value > 0, { timeout: 60000 });
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

test('map pans and zooms with the keyboard', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  const state = () => page.evaluate(async () => {
    await syncHash();
    return decodeShareHash(location.hash.slice(1));
  });
  await page.focus('#map');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  const s1 = await state();
  expect(s1.x).toBeGreaterThan(-392);
  expect(s1.z).toBeGreaterThan(56);
  await page.keyboard.press('-');
  const s2 = await state();
  expect(s2.b).toBeGreaterThan(s1.b);
  await page.keyboard.press('+');
  const s3 = await state();
  expect(s3.b).toBeLessThan(s2.b);
});

test('axe-core audit: no WCAG A/AA violations in either theme', async ({ page }) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  await page.goto('/');
  await waitForApp(page);
  for (const theme of ['dark', 'light']) {
    await page.evaluate((th) => document.documentElement.dataset.theme = th, theme);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations, theme + ': ' + JSON.stringify(results.violations.map((v) => ({
      id: v.id, nodes: v.nodes.map((n) => n.target)
    })), null, 2)).toEqual([]);
  }
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 740 }, hasTouch: true });

  test('the criteria panel folds into a drawer on small screens', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    const toggle = page.locator('#panelToggle');
    await expect(toggle).toBeVisible();
    await expect(page.locator('#panel')).toBeVisible();
    await toggle.click();
    await expect(page.locator('#panel')).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(page.locator('#panel')).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('two-finger pinch zooms the map', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    const before = 2.2;   // default view.bpp — there is no hash before any interaction
    // synthetic two-pointer pinch: fingers move apart -> zoom in (smaller bpp)
    await page.evaluate(() => {
      const c = document.querySelector('#map');
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, {
        pointerId: id, pointerType: 'touch', clientX: x, clientY: y, isPrimary: id === 1, bubbles: true
      }));
      ev('pointerdown', 1, cx - 40, cy); ev('pointerdown', 2, cx + 40, cy);
      for (let i = 1; i <= 5; i++) {
        ev('pointermove', 1, cx - 40 - i * 20, cy); ev('pointermove', 2, cx + 40 + i * 20, cy);
      }
      ev('pointerup', 1, cx - 140, cy); ev('pointerup', 2, cx + 140, cy);
    });
    // the hash write is asynchronous now: re-sync before reading it back
    const zoomed = await page.evaluate(async () => { await syncHash(); return (await decodeShareHash(location.hash.slice(1))).b; });
    expect(zoomed).toBeLessThan(before);
  });
});

test('minimap recenters the map and the grid toggle draws the overlay', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await expect(page.locator('#minimap')).toBeVisible();
  // click right of the minimap center: the view center must move east
  await page.click('#minimap', { position: { x: 128, y: 66 } });
  const s = await page.evaluate(async () => { await syncHash(); return decodeShareHash(location.hash.slice(1)); });
  expect(s.x).toBeGreaterThan(-392);
  expect(s.z).toBe(56);
  // grid overlay toggles without breaking rendering
  await page.check('#gridChk');
  await expect(page.locator('#gridChk')).toBeChecked();
  await page.uncheck('#gridChk');
  await expect(page.locator('#gridChk')).not.toBeChecked();
});

test('the Y slider reveals underground biomes and survives the share link', async ({ page, context }) => {
  await page.goto('/');
  await waitForApp(page);
  const tileRow = () => page.evaluate(() => {
    const c = document.querySelector('#map');
    return c.getContext('2d').getImageData(0, Math.floor(c.height / 2), c.width, 1).data.join(',');
  });
  const surface = await tileRow();
  // drop to deep-slate depths: the rendered tile must change
  await page.locator('#ySlider').fill('-52');
  await page.locator('#ySlider').dispatchEvent('change');
  await expect(page.locator('#yVal')).toHaveText('-52');
  await expect.poll(tileRow).not.toBe(surface);
  // the share link restores the altitude
  const url = await page.evaluate(() => location.href);
  const p2 = await context.newPage();
  await p2.goto(url);
  await waitForApp(p2);
  await expect(p2.locator('#yVal')).toHaveText('-52');
  const s = await p2.evaluate(() => decodeShareHash(location.hash.slice(1)));
  expect(s.y).toBe(-52);
});

test('surface-height criterion finds peaks and rejects impossible bands', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  // widen to any common biome so the surface clause does the filtering
  await page.$eval('#mainBiomes .row select', (s) => {
    s.value = [...s.options].find((o) => o.dataset.biome === 'plains').value;
  });
  await page.click('#adjClauses .row .rm');
  await page.click('#structClauses .row .rm');
  await page.fill('#range', '3000');
  // plains sit near sea level: an impossible band must yield no match
  await page.fill('#surfMin', '250');
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveClass(/empty/);
  // a sane band matches
  await page.fill('#surfMin', '60');
  await page.fill('#surfMax', '90');
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveClass(/ok/);
});

test('cached tiles repaint instantly when panning back', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  // wait for the first rendered tile
  await page.waitForFunction(() => {
    const c = document.querySelector('#map');
    const d = c.getContext('2d').getImageData(0, Math.floor(c.height / 2), c.width, 1).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] !== 12 || d[i + 1] !== 16 || d[i + 2] !== 22) return true;
    return false;
  });
  // pan away and immediately back with the keyboard, then read the canvas
  // synchronously — before the debounced worker render (90 ms) can land:
  // only the cache can have painted these pixels
  const centerNotBackground = await page.evaluate(() => {
    const c = document.querySelector('#map');
    const press = (key) => c.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    for (let i = 0; i < 5; i++) press('ArrowRight');
    for (let i = 0; i < 5; i++) press('ArrowLeft');
    const d = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    return d[0] !== 12 || d[1] !== 16 || d[2] !== 22;
  });
  expect(centerNotBackground).toBe(true);
});

test('structure pair criterion finds village+outpost spots', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  // the village-outpost preset is known to match on seed 141: replace its two
  // structure clauses by one pair clause with the same meaning
  await page.selectOption('#presetSel', 'village-outpost');
  while (await page.locator('#structClauses .row').count()) {
    await page.click('#structClauses .row .rm');
  }
  await page.click('#addPair');
  const sels = page.locator('#pairClauses .row select');
  await sels.nth(0).selectOption({ label: 'Village' });
  await sels.nth(1).selectOption({ label: 'Pillager outpost' });
  const nums = page.locator('#pairClauses .row input.num');
  await nums.nth(0).fill('600');
  await nums.nth(1).fill('800');
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveClass(/ok/);
});

test('in-main-biome flag and quad hut layer work without errors', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  // demo criteria pass with the village clause restricted to the main biome?
  // villages never stand in a cherry grove: the search must now find nothing
  await page.check('#structClauses .row input.inmain');
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveClass(/empty/);
  // the quad hut layer toggles cleanly (usually empty: quads are very rare)
  const quadLayer = page.locator('#structLayers .layer', { hasText: 'Quad witch huts' });
  await expect(quadLayer).toHaveCount(1);
  await quadLayer.locator('input').check();
  await expect(quadLayer.locator('input')).toBeChecked();
});

test('multi-seed search finds candidate seeds and loads one', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/');
  await waitForApp(page);
  // very common criteria so a few sequential seeds are enough: plains OR forest
  await page.$eval('#mainBiomes .row select', (s) => {
    s.value = [...s.options].find((o) => o.dataset.biome === 'plains').value;
  });
  await page.click('#addMainBiome');
  await page.$eval('#mainBiomes .row:nth-child(2) select', (s) => {
    s.value = [...s.options].find((o) => o.dataset.biome === 'forest').value;
  });
  await page.click('#adjClauses .row .rm');
  await page.click('#structClauses .row .rm');
  await page.selectOption('#seedMode', 'seq');
  await page.fill('#seedCount', '8');
  await page.fill('#seedRadius', '1500');
  await page.click('#seedSearchBtn');
  await page.waitForFunction(() => {
    const el = document.querySelector('#seedInfo');
    return el.textContent.length > 0 && !el.classList.contains('busy');
  }, { timeout: 120000 });
  await expect(page.locator('#seedInfo')).toHaveClass(/ok/);
  const first = page.locator('#seedResults .result').first();
  await expect(first).toBeVisible();
  // rows carry the score: place count and best-place distance to the origin
  await expect(first.locator('.rc')).toContainText('⚑');
  const scores = await page.$$eval('#seedResults .result .rc', (els) =>
    els.map((e) => Number.parseInt(e.textContent, 10)));
  const sorted = [...scores].sort((a, b) => b - a);
  expect(scores).toEqual(sorted);   // best candidates first
  const seed = await first.locator('.rx').textContent();
  await first.click();
  await expect(page.locator('#seed')).toHaveValue(seed);
});

test('the minimap is painted across its whole surface', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  // wait for a minimap tile, then assert how much of the canvas is painted
  // (before the fix, the tile sat unscaled in the corner: ~12% covered)
  const paintedRatio = () => page.evaluate(() => {
    const mm = document.querySelector('#minimap');
    const d = mm.getContext('2d').getImageData(0, 0, mm.width, mm.height).data;
    let painted = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] !== 12 || d[i + 1] !== 16 || d[i + 2] !== 22) painted++;
    }
    return painted / (mm.width * mm.height);
  });
  await page.waitForFunction(() => {
    const mm = document.querySelector('#minimap');
    const d = mm.getContext('2d').getImageData(0, 0, mm.width, 1).data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] !== 12 || d[i + 1] !== 16 || d[i + 2] !== 22) return true;
    }
    return false;
  }, { timeout: 15000 });
  expect(await paintedRatio()).toBeGreaterThan(0.9);
});

test('the go-to control recenters the map and rejects bad input', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  const state = () => page.evaluate(async () => {
    await syncHash();
    return decodeShareHash(location.hash.slice(1));
  });
  await page.fill('#gotoInput', '1234, -5678');
  await page.press('#gotoInput', 'Enter');
  const s = await state();
  expect(s.x).toBe(1234);
  expect(s.z).toBe(-5678);
  // malformed input is flagged and does not move the view
  await page.fill('#gotoInput', 'nope');
  await page.press('#gotoInput', 'Enter');
  await expect(page.locator('#gotoInput')).toHaveClass(/bad/);
  const s2 = await state();
  expect(s2.x).toBe(1234);
  // typing again clears the error state
  await page.fill('#gotoInput', '0, 0');
  await expect(page.locator('#gotoInput')).not.toHaveClass(/bad/);
});

test('the ruler measures a distance between two clicks', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.click('#rulerBtn');
  await expect(page.locator('#rulerBtn')).toHaveClass(/on/);
  const box = await page.locator('#map').boundingBox();
  // clicks land well away from the map-corner controls (goto form, ruler)
  await page.mouse.click(box.x + 300, box.y + 300);
  await page.mouse.click(box.x + 400, box.y + 300);
  const r = await page.evaluate(() => ruler);
  expect(r.done).toBe(true);
  expect(r.b.x - r.a.x).toBeGreaterThan(0);
  expect(r.b.z).toBe(r.a.z);
  // Escape leaves ruler mode and clears the measurement
  await page.focus('#map');
  await page.keyboard.press('Escape');
  await expect(page.locator('#rulerBtn')).not.toHaveClass(/on/);
  const r2 = await page.evaluate(() => ruler);
  expect(r2.on).toBe(false);
  expect(r2.a).toBeNull();
});

test('a finished search lands in the history and replays on click', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await expect(page.locator('#histList .hist')).toHaveCount(0);
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#histList .hist')).toHaveCount(1);
  await expect(page.locator('#histList .hist').first()).toContainText('141');
  // replaying restores the criteria and re-runs the same search
  await page.click('#histList .hist');
  await waitForSearchDone(page);
  const rows = await page.locator('#mainBiomes .row').count();
  expect(rows).toBeGreaterThan(0);
  // still a single entry: the identical search must not duplicate
  await expect(page.locator('#histList .hist')).toHaveCount(1);
  // the history survives a reload (localStorage)
  await page.reload();
  await waitForApp(page);
  await expect(page.locator('#histList .hist')).toHaveCount(1);
});

test('custom presets save, replay and delete', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  // save the demo criteria under a custom name
  await page.fill('#presetName', 'Mon spot');
  await page.click('#presetSave');
  await expect(page.locator('#presetSel option')).toContainText(['Mon spot']);
  // the freshly saved preset is selected and deletable
  await expect(page.locator('#presetDel')).toBeVisible();
  // survives a reload and replays the criteria
  await page.reload();
  await waitForApp(page);
  await page.selectOption('#presetSel', { label: 'Mon spot' });
  const rows = await page.locator('#mainBiomes .row').count();
  expect(rows).toBeGreaterThan(0);
  // delete removes it from the select
  await page.click('#presetDel');
  await expect(page.locator('#presetSel')).not.toContainText('Mon spot');
  await expect(page.locator('#presetDel')).toBeHidden();
});

test('the high-visibility palette repaints the map and persists', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  const centerPixel = () => page.evaluate(() => {
    const c = document.querySelector('#map');
    const d = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    return [d[0], d[1], d[2]].join(',');
  });
  // wait until the default tile is actually painted (not the empty canvas)
  await page.waitForFunction(() => {
    const c = document.querySelector('#map');
    const d = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    return d[3] === 255;
  });
  const before = await centerPixel();
  await page.click('#paletteBtn');
  await expect(page.locator('#paletteBtn')).toHaveClass(/on/);
  // the tile re-renders with the remapped table: the center pixel changes
  await page.waitForFunction((prev) => {
    const c = document.querySelector('#map');
    const d = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    return d[3] === 255 && [d[0], d[1], d[2]].join(',') !== prev;
  }, before);
  // the choice survives a reload
  await page.reload();
  await waitForApp(page);
  await expect(page.locator('#paletteBtn')).toHaveClass(/on/);
});

/* global tileCache, pendingTiles */
test('the tile checkerboard reuses cached tiles when panning back', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  // initial view fully tiled
  await page.waitForFunction(() => pendingTiles.size === 0 && tileCache.size() > 0);
  await page.focus('#map');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => pendingTiles.size === 0);
  const sizeAfterPan = await page.evaluate(() => tileCache.size());
  // panning back needs no new tiles: everything is already cached
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => pendingTiles.size === 0);
  const sizeAfterBack = await page.evaluate(() => tileCache.size());
  expect(sizeAfterBack).toBe(sizeAfterPan);
});

test('the A/B version compare swaps the generation and keeps the view', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  const state = () => page.evaluate(async () => {
    await syncHash();
    return decodeShareHash(location.hash.slice(1));
  });
  await expect(page.locator('#cmpSwap')).toBeHidden();
  const mainVer = await page.locator('#mcver').inputValue();
  // arm a compare version different from the current one
  const other = await page.$eval('#cmpVer', (sel, cur) =>
    [...sel.options].map((o) => o.value).find((v) => v && v !== cur), mainVer);
  await page.selectOption('#cmpVer', other);
  await expect(page.locator('#cmpSwap')).toBeVisible();
  const before = await state();
  await page.click('#cmpSwap');
  const s1 = await state();
  expect(String(s1.m)).toBe(other);          // generation swapped
  expect(s1.x).toBe(before.x);               // view preserved
  expect(s1.z).toBe(before.z);
  await expect(page.locator('#cmpVer')).toHaveValue(mainVer);
  // the V key swaps back
  await page.focus('#map');
  await page.keyboard.press('v');
  const s2 = await state();
  expect(String(s2.m)).toBe(mainVer);
});

test('custom markers: place on click, rename, persist, delete', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.click('#markerBtn');
  await expect(page.locator('#markerBtn')).toHaveClass(/on/);
  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + 300, box.y + 300);
  await expect(page.locator('#markerList .fav')).toHaveCount(1);
  // rename sticks
  await page.fill('#markerList .fav-note', 'Ma base');
  await page.press('#markerList .fav-note', 'Enter');
  // markers survive a reload (localStorage), marker mode does not
  await page.reload();
  await waitForApp(page);
  await expect(page.locator('#markerList .fav-note')).toHaveValue('Ma base');
  await expect(page.locator('#markerBtn')).not.toHaveClass(/on/);
  // delete empties the list
  await page.click('#markerList .rm');
  await expect(page.locator('#markerList .fav')).toHaveCount(0);
});

test('the Nether grid overlay shows both referentials in the HUD', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.check('#netherChk');
  const box = await page.locator('#map').boundingBox();
  await page.mouse.move(box.x + 300, box.y + 300);
  await expect(page.locator('#hud .coords')).toContainText('⇄ Nether');
  // unchecked: back to the single referential
  await page.uncheck('#netherChk');
  await page.mouse.move(box.x + 320, box.y + 300);
  await expect(page.locator('#hud .coords')).not.toContainText('⇄');
});

test('a biome-share criterion filters results and survives the share link', async ({ page, context }) => {
  await page.goto('/');
  await waitForApp(page);
  // demo criteria + "at least 20% cherry grove within 100 blocks": the spot
  // cell itself is a cherry grove, so a small disc keeps a high share
  await page.click('#addPct');
  const row = page.locator('#pctClauses .row');
  await row.locator('select').selectOption({ label: 'Cherry Grove' });
  const nums = row.locator('input.num');
  await nums.nth(0).fill('20');
  await nums.nth(1).fill('100');
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveClass(/ok/);
  // an impossible floor finds nothing
  await nums.nth(0).fill('100');
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveClass(/empty/);
  // the share link restores the clause
  const url = await page.evaluate(async () => { await syncHash(); return location.href; });
  const p2 = await context.newPage();
  await p2.goto(url);
  await waitForApp(p2);
  await expect(p2.locator('#pctClauses .row')).toHaveCount(1);
  await expect(p2.locator('#pctClauses .row input.num').first()).toHaveValue('100');
});

test('an interrupted seed search survives a reload and resumes', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.fill('#seedCount', '20000');
  await page.click('#seedSearchBtn');   // the button flips to Cancel
  await page.waitForFunction(() => document.querySelector('#seedProgress').value > 0, { timeout: 60000 });
  await page.click('#seedSearchBtn');   // cancel mid-run
  await expect(page.locator('#seedResumeBtn')).toBeVisible();
  await expect(page.locator('#seedResumeBtn')).toContainText('/20000');
  // the run state survives a full page reload
  await page.reload();
  await waitForApp(page);
  await expect(page.locator('#seedResumeBtn')).toBeVisible();
  await expect(page.locator('#seedResumeBtn')).toContainText('/20000');
  // resuming picks the scan back up where it stopped
  await page.click('#seedResumeBtn');
  await expect(page.locator('#seedResumeBtn')).toBeHidden();
  await expect(page.locator('#seedInfo')).toHaveClass(/busy/);
  await page.waitForFunction(() => document.querySelector('#seedProgress').value > 0, { timeout: 60000 });
  // cancel again: the snapshot is refreshed, not lost
  await page.click('#seedSearchBtn');
  await expect(page.locator('#seedResumeBtn')).toBeVisible();
});

test('an adjacency clause with its own Y layer searches and shares', async ({ page, context }) => {
  await page.goto('/');
  await waitForApp(page);
  // pin the demo's warm-ocean clause to Y=63 (sea level): the worker must
  // generate the extra layer and the search still finds the demo spot
  await page.fill('#adjClauses .row input.yopt', '63');
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveClass(/ok/);
  // the share link carries the clause altitude
  const url = await page.evaluate(async () => { await syncHash(); return location.href; });
  const p2 = await context.newPage();
  await p2.goto(url);
  await waitForApp(p2);
  await expect(p2.locator('#adjClauses .row input.yopt')).toHaveValue('63');
});

test('a geographic-pattern clause runs the search and shares', async ({ page, context }) => {
  await page.goto('/');
  await waitForApp(page);
  // demo criteria + "the spot is on an island of at most 500 blocks": the
  // demo cherry grove is on the mainland, so the search completes empty
  await page.click('#addShape');
  const row = page.locator('#shapeClauses .row');
  await row.locator('select').first().selectOption('island');
  await row.locator('input.num').fill('500');
  // the biome pair only applies to enclaves: disabled here
  await expect(row.locator('select').nth(1)).toBeDisabled();
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveClass(/empty|ok/);
  await expect(page.locator('#searchInfo')).not.toHaveClass(/err/);
  // the share link restores the clause
  const url = await page.evaluate(async () => { await syncHash(); return location.href; });
  const p2 = await context.newPage();
  await p2.goto(url);
  await waitForApp(p2);
  await expect(p2.locator('#shapeClauses .row')).toHaveCount(1);
  await expect(p2.locator('#shapeClauses .row select').first()).toHaveValue('island');
  await expect(p2.locator('#shapeClauses .row input.num')).toHaveValue('500');
});

test('the profile round-trips through export and import', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  const profile = {
    kind: 'seedcartographer-profile', version: 1,
    favorites: [{ id: 1, seed: '141', mc: 22, large: false, dim: 0, x: 5, z: 6, note: 'ici' }],
    userPresets: [{ id: 1, name: 'mon preset', dim: 0, c: { m: [5] } }],
    history: [],
    markers: [{ id: 1, seed: '141', mc: 22, large: false, dim: 0, x: 9, z: 9, name: 'spot' }]
  };
  await page.setInputFiles('#profileImportFile', {
    name: 'profile.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(profile))
  });
  await expect(page.locator('#profileInfo')).toContainText('1');
  // the imported stores are live: preset in the selector, marker listed
  await expect(page.locator('#presetSel option[value="user:1"], #presetSel option')).toContainText(['mon preset']);
  // exporting downloads a JSON profile file
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#profileExport')]);
  expect(dl.suggestedFilename()).toBe('seedcartographer-profile.json');
});

test('the profile also round-trips through a copy/paste sync code', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.setInputFiles('#profileImportFile', {
    name: 'profile.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      kind: 'seedcartographer-profile', version: 1,
      favorites: [], userPresets: [{ id: 1, name: 'sync preset', dim: 0, c: { m: [5] } }],
      history: [], markers: []
    }))
  });
  await page.click('#syncCodeShow');
  await expect(page.locator('#syncCodeBox')).toBeVisible();
  const code = await page.locator('#syncCodeText').inputValue();
  expect(code.length).toBeGreaterThan(0);
  // simulate a second device: reload (fresh in-memory state, same localStorage
  // in this test context) then paste the code back in
  await page.click('#syncCodePaste');
  await page.locator('#syncCodeText').fill(code);
  await page.click('#syncCodeApply');
  await expect(page.locator('#profileInfo')).toContainText('1');
  await expect(page.locator('#syncCodeBox')).toBeHidden();
});

test('the relief overlay reshades the map tiles and is Overworld-only', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  // capture a pixel strip at the center, toggle relief, wait for a reshade
  const strip = () => page.evaluate(() => {
    const c = document.querySelector('#map');
    return [...c.getContext('2d').getImageData(c.width / 2 - 64, Math.floor(c.height / 2), 128, 1).data];
  });
  const before = await strip();
  await page.check('#reliefChk');
  await expect.poll(strip, { timeout: 15000 }).not.toEqual(before);
  // the End has no surface: the toggle disappears; back home it returns
  await page.selectOption('#dimSel', '1');
  await expect(page.locator('#reliefToggleLbl')).toBeHidden();
  await page.selectOption('#dimSel', '0');
  await expect(page.locator('#reliefToggleLbl')).toBeVisible();
});

test('the area selection drags a rectangle and copies its coordinates', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await waitForApp(page);
  await page.click('#selBtn');
  await expect(page.locator('#selBtn')).toHaveClass(/on/);
  const box = await page.locator('#map').boundingBox();
  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 420, box.y + 380);
  await page.mouse.up();
  // the toolbar shows the world-block summary of the dragged rectangle
  await expect(page.locator('#selBar')).toBeVisible();
  await expect(page.locator('#selInfo')).toContainText('->');
  await page.click('#selCopy');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/-?\d+, -?\d+ -> -?\d+, -?\d+ \(\d+ x \d+\)/);
  // Escape leaves selection mode and hides the toolbar
  await page.focus('#map');
  await page.keyboard.press('Escape');
  await expect(page.locator('#selBar')).toBeHidden();
  await expect(page.locator('#selBtn')).not.toHaveClass(/on/);
});

test('a page error sends a privacy-safe event to Umami if loaded', async ({ page }) => {
  await page.addInitScript(() => {
    window.__umamiCalls = [];
    window.umami = { track: (name, data) => window.__umamiCalls.push([name, data]) };
  });
  await page.goto('/');
  await waitForApp(page);
  await page.evaluate(() => {
    const e = new ErrorEvent('error', { message: 'synthetic e2e error', filename: 'https://x/app.js?v=1', lineno: 7 });
    window.dispatchEvent(e);
  });
  const calls = await page.evaluate(() => window.__umamiCalls);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toEqual(['error', { kind: 'error', message: 'synthetic e2e error', source: 'app.js', line: 7 }]);
});
