// "Surprise me" (#287): a random seed satisfying the current criteria is
// found within the budget, loaded into the seed field, and the map centers
// on the spot with a temporary pin, like the rare-biome jump.
/* global rarePinAt, viewCenter */ // app.js test hooks, read via page.evaluate
import { test, expect } from './fixtures.js';

test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
});

async function waitForApp(page) {
  await page.waitForFunction(() => document.querySelectorAll('#mainBiomes .row select option').length > 0);
}

test('surprise me finds a seed for easy criteria, loads it and pins the spot', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/');
  await waitForApp(page);
  // very common criteria so the first random seeds match: plains OR forest
  await page.$eval('#mainBiomes .row select', (s) => {
    s.value = [...s.options].find((o) => o.dataset.biome === 'plains').value;
  });
  await page.click('#addMainBiome');
  await page.$eval('#mainBiomes .row:nth-child(2) select', (s) => {
    s.value = [...s.options].find((o) => o.dataset.biome === 'forest').value;
  });
  await page.click('#adjClauses .row .rm');
  await page.click('#structClauses .row .rm');
  await page.fill('#seedRadius', '1500');
  const before = await page.inputValue('#seed');
  await page.click('#surpriseBtn');
  // busy: the button flips to Cancel and progress messages count the seeds
  await expect(page.locator('#surpriseBtn')).not.toHaveText(/🎲/);
  await page.waitForFunction(() => {
    const el = document.querySelector('#seedInfo');
    return el.textContent.length > 0 && !el.classList.contains('busy');
  }, { timeout: 120000 });
  await expect(page.locator('#seedInfo')).toHaveClass(/ok/);
  // the found seed is loaded and differs from the previous one (64-bit random)
  const seed = await page.inputValue('#seed');
  expect(seed).not.toBe(before);
  expect(seed).toMatch(/^-?\d+$/);
  // the map centered on the found spot and dropped the temporary pin there
  const { pin, center } = await page.evaluate(() =>
    ({ pin: rarePinAt(), center: viewCenter() }));
  expect(pin).not.toBeNull();
  expect(center.x).toBe(pin.x);
  expect(center.z).toBe(pin.z);
  // the button is back to its idle label, ready for another roll
  await expect(page.locator('#surpriseBtn')).toHaveText(/🎲/);
});
