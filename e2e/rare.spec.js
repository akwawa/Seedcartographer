// e2e for the one-click "nearest rare biome" search (#252): a findable biome
// on the built-in demo seed jumps the map to the hit with a temporary pin;
// on MC 1.18 cherry groves do not exist, which gives a deterministic
// not-found run (full ring scan) and a long-enough window to cancel.
/* global rarePinAt */ // app.js binding, read via page.evaluate
import { test, expect } from './fixtures.js';

test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
});

async function waitForApp(page) {
  await page.waitForFunction(() => document.querySelectorAll('#mainBiomes .row select option').length > 0);
}
const cherryBtn = '#rareList button[data-biome="cherry_grove"]';

test('clicking a rare biome centers the map on the nearest hit with a pin', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await expect(page.locator(cherryBtn)).toHaveText('Cherry Grove');
  await page.click(cherryBtn);
  await page.waitForFunction(() => {
    const el = document.querySelector('#rareInfo');
    return el.textContent.length > 0 && !el.classList.contains('busy');
  }, { timeout: 90000 });
  await expect(page.locator('#rareInfo')).toHaveClass(/ok/);
  // the temporary pin exists and the popup shows its coordinates
  const pin = await page.evaluate(() => rarePinAt());
  expect(pin).not.toBeNull();
  await expect(page.locator('#popup')).toBeVisible();
  await expect(page.locator('#popup .pop-x')).toHaveText(`${pin.x}, ${pin.z}`);
  // the view recentered on the hit (the share hash carries the view center;
  // the hash write is async, so poll until it reflects the pin)
  await page.waitForFunction(async () => {
    const p = rarePinAt();
    if (!p) return false;
    const s = await decodeShareHash(location.hash.slice(1));
    return s !== null && s.x === p.x && s.z === p.z;
  });
  // closing the popup clears the temporary pin
  await page.click('.pop-close');
  expect(await page.evaluate(() => rarePinAt())).toBeNull();
});

test('an unfindable rare biome reports not-found after the full ring scan', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.selectOption('#mcver', '22');   // 1.18: cherry groves do not exist
  await page.click(cherryBtn);
  await page.waitForFunction(() => {
    const el = document.querySelector('#rareInfo');
    return el.textContent.length > 0 && !el.classList.contains('busy');
  }, { timeout: 90000 });
  await expect(page.locator('#rareInfo')).toHaveClass(/empty/);
  await expect(page.locator('#rareInfo')).toHaveText(/10240/);
  expect(await page.evaluate(() => rarePinAt())).toBeNull();
});

test('a rare-biome search shows progress and can be cancelled', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.selectOption('#mcver', '22');   // guaranteed full (slow) scan
  await page.click(cherryBtn);
  // the clicked button flips to Cancel and the progress bar appears
  await expect(page.locator(cherryBtn)).toHaveText(/Cancel/);
  await expect(page.locator('#rareProgress')).toBeVisible();
  await page.waitForFunction(() => document.querySelector('#rareProgress').value > 0, { timeout: 60000 });
  await page.click(cherryBtn);
  await page.waitForFunction(() => {
    const el = document.querySelector('#rareInfo');
    return el.textContent.length > 0 && !el.classList.contains('busy');
  }, { timeout: 90000 });
  await expect(page.locator('#rareInfo')).toHaveText(/cancelled/i);
  // the button label is restored and a fresh search still works
  await expect(page.locator(cherryBtn)).toHaveText('Cherry Grove');
  await page.selectOption('#mcver', '28');
  await page.click(cherryBtn);
  await page.waitForFunction(() => document.querySelector('#rareInfo').classList.contains('ok'), { timeout: 90000 });
});
