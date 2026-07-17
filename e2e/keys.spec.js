// Global keyboard shortcuts (#230). The pure key→action mapping is unit
// tested (test/keys.test.mjs); these scenarios exercise the DOM glue on a
// few representative shortcuts.
import { test, expect } from './fixtures.js';

test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
});

async function waitForBoot(page) {
  await page.waitForFunction(() => document.querySelector('#searchBtn') !== null);
}

test('"?" opens the help dialog and Escape closes it', async ({ page }) => {
  await page.goto('/');
  await waitForBoot(page);
  await page.locator('#map').focus();
  await page.keyboard.press('?');
  await expect(page.locator('#helpDlg')).toBeVisible();
  await expect(page.locator('#helpDlg .help-keys li')).toHaveCount(6);
  await page.keyboard.press('Escape');
  await expect(page.locator('#helpDlg')).toBeHidden();
});

test('"G" focuses the go-to-coordinates box, "R" toggles the ruler', async ({ page }) => {
  await page.goto('/');
  await waitForBoot(page);
  await page.locator('#map').focus();
  await page.keyboard.press('g');
  await expect(page.locator('#gotoInput')).toBeFocused();
  // typing in the goto box must not fire the letter shortcuts
  await page.keyboard.type('r, g');
  await expect(page.locator('#gotoInput')).toHaveValue('r, g');
  await expect(page.locator('#rulerBtn')).not.toHaveClass(/on/);
  await page.locator('#map').focus();
  await page.keyboard.press('R');
  await expect(page.locator('#rulerBtn')).toHaveClass(/on/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#rulerBtn')).not.toHaveClass(/on/);
});

test('typing letters in the seed field does not trigger shortcuts', async ({ page }) => {
  await page.goto('/');
  await waitForBoot(page);
  const seed = page.locator('#seed');
  await seed.click();
  await seed.fill('');
  await page.keyboard.type('grg?r');
  await expect(seed).toHaveValue('grg?r');
  await expect(page.locator('#helpDlg')).toBeHidden();
  await expect(page.locator('#rulerBtn')).not.toHaveClass(/on/);
  await expect(page.locator('#gotoInput')).not.toBeFocused();
});
