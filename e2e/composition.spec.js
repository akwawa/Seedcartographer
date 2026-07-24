// #286: biome composition panel — arm the ◔ tool, click the map and check
// that a breakdown shows up with percentages summing to ~100.
import { test, expect } from './fixtures.js';

async function waitForApp(page) {
  await page.waitForFunction(() => document.querySelectorAll('#mainBiomes .row select option').length > 0);
}

async function compPctSum(page) {
  return page.$$eval('#popup .comp-row',
    (rows) => rows.reduce((s, r) => s + parseFloat(r.dataset.pct), 0));
}

test('the composition tool shows a biome breakdown summing to ~100%', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.click('#compBtn');
  await expect(page.locator('#compBtn')).toHaveClass(/on/);
  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  // the tool disarms after the click and the panel opens
  await expect(page.locator('#compBtn')).not.toHaveClass(/on/);
  await expect(page.locator('#popup')).toBeVisible();
  await expect(page.locator('#popup .comp-row').first()).toBeVisible();
  const sum = await compPctSum(page);
  expect(sum).toBeGreaterThan(99);
  expect(sum).toBeLessThan(101);
  // every row shows a one-decimal percentage
  const texts = await page.$$eval('#popup .comp-row .comp-pct', (els) => els.map((e) => e.textContent));
  for (const txt of texts) expect(txt).toMatch(/^\d+\.\d %$/);
  // switching the radius re-samples; the new breakdown still sums to ~100
  await page.selectOption('#compRadius', '1024');
  await expect(page.locator('#popup .comp-row').first()).toBeVisible();
  const sum2 = await compPctSum(page);
  expect(sum2).toBeGreaterThan(99);
  expect(sum2).toBeLessThan(101);
  // the panel closes with its × button
  await page.click('#popup .pop-close');
  await expect(page.locator('#popup')).toBeHidden();
});
