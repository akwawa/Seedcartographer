'use strict';
const { test, expect } = require('@playwright/test');

test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
});

test('manifest and icon are served', async ({ page }) => {
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).name).toBe('Seedcartographer');
  const icon = await page.request.get('/icon.svg');
  expect(icon.ok()).toBeTruthy();
});

test('service worker installs and the app boots offline', async ({ page, context }) => {
  await page.goto('/');
  // wait for the SW to be active, then reload so the page is controlled
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  // the whole engine (WASM included) must come from the cache
  await page.waitForFunction(() => document.querySelectorAll('#mainBiomes .row select option').length > 0);
  await page.click('#searchBtn');
  await page.waitForFunction(() => {
    const el = document.querySelector('#searchInfo');
    return el.textContent.length > 0 && !el.classList.contains('busy');
  }, { timeout: 90000 });
  await expect(page.locator('#searchInfo')).toHaveClass(/ok/);
  await context.setOffline(false);
});
