'use strict';
const { test, expect } = require('@playwright/test');

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
