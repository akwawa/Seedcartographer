// e2e for the sketch search (#326): drawing an ocean stripe on the 5×5
// mini-grid anchors a search on its own (no main biome, no structures) and
// finds plausible coastal spots on the built-in demo seed. The sketch also
// round-trips through the custom presets.
import { test, expect } from './fixtures.js';

test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
});

async function waitForApp(page) {
  await page.waitForFunction(() => document.querySelectorAll('#mainBiomes .row select option').length > 0);
}
async function waitForSearchDone(page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#searchInfo');
    return el.textContent.length > 0 && !el.classList.contains('busy');
  }, { timeout: 90000 });
}
// remove every demo criteria row so the sketch is the only criterion
async function clearCriteriaRows(page) {
  await page.evaluate(() => {
    document.querySelectorAll('#criteriaCard .crit .row .rm').forEach((b) => b.click());
  });
}
// paint the left column of the sketch as ocean (first family in the cycle)
async function paintLeftColumnOcean(page) {
  await page.$eval('#sketchSec', (el) => { el.open = true; });
  for (const idx of [0, 5, 10, 15, 20]) {
    await page.click(`#sketchGrid button[data-idx="${idx}"]`);
  }
}

test('a left-ocean sketch alone finds plausible coastal spots', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await clearCriteriaRows(page);
  await paintLeftColumnOcean(page);
  // painted cells expose their family through the accessible name
  await expect(page.locator('#sketchGrid button[data-idx="0"]'))
    .toHaveAttribute('aria-label', 'Row 1 column 1: Ocean');
  // rotations + mirrors accept a coastline on any side; keep the run short
  await page.check('#sketchRot');
  await page.check('#sketchMir');
  await page.fill('#sketchPct', '60');
  await page.fill('#range', '3000');
  await page.fill('#step', '128');
  await page.click('#searchBtn');
  await waitForSearchDone(page);
  await expect(page.locator('#searchInfo')).toHaveClass(/ok/);
  await expect(page.locator('#results .result').first()).toBeVisible();
});

test('the sketch is saved and restored with a custom preset', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await paintLeftColumnOcean(page);
  await page.check('#sketchRot');
  await page.fill('#presetName', 'coast sketch');
  await page.click('#presetSave');
  // clearing the sketch, then loading the preset, restores the drawing
  await page.click('#sketchClear');
  await expect(page.locator('#sketchGrid button.set')).toHaveCount(0);
  await page.selectOption('#presetSel', { label: 'coast sketch' });
  await expect(page.locator('#sketchGrid button.set')).toHaveCount(5);
  await expect(page.locator('#sketchSec')).toHaveJSProperty('open', true);
  await expect(page.locator('#sketchRot')).toBeChecked();
});
