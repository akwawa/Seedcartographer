'use strict';
const { test, expect } = require('@playwright/test');

// Time-to-first-map-render budget: from navigation start until a fresh grid
// tile is actually painted on the canvas (engine booted, WASM compiled,
// first tile computed and blitted). The e2e counterpart of the scanGrid
// micro-benchmark; generous enough for CI runner noise, tight enough to
// catch a real boot/render regression.
const BUDGET_MS = Number.parseInt(process.env.RENDER_BUDGET_MS || '15000', 10);

test('the first map render lands within the time budget', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => {
    const c = document.querySelector('#map');
    if (!c) return false;
    const d = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    return d[3] === 255;
  }, { timeout: BUDGET_MS + 30000 });
  const ms = await page.evaluate(() => performance.now());
  console.log(`first map render: ${Math.round(ms)} ms (budget ${BUDGET_MS} ms)`);
  expect(ms).toBeLessThanOrEqual(BUDGET_MS);
});
