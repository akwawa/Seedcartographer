// First-visit guided tour (#229). Unlike the other suites (which import
// e2e/fixtures.js to pre-dismiss the tour), these tests use the raw
// Playwright test: a fresh context has no localStorage, i.e. a first visit.
import { test, expect } from '@playwright/test';

test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
});

test('first visit: the tour walks through its 4 steps and never comes back', async ({ page }) => {
  await page.goto('/');
  const bubble = page.locator('.tour-bubble');
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveAttribute('role', 'dialog');
  await expect(page.locator('.tour-counter')).toHaveText('Step 1 of 4');
  await expect(page.locator('.tour-ring')).toBeVisible();
  // "Next" holds the focus so the keyboard drives the tour
  await expect(page.locator('.tour-next')).toBeFocused();
  for (let i = 2; i <= 4; i++) {
    await page.click('.tour-next');
    await expect(page.locator('.tour-counter')).toHaveText(`Step ${i} of 4`);
  }
  await expect(page.locator('.tour-next')).toHaveText('Done');
  await page.click('.tour-next');
  await expect(bubble).toHaveCount(0);
  await expect(page.locator('.tour-overlay')).toHaveCount(0);
  // completed once → never auto-shows again
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#searchBtn') !== null);
  await expect(page.locator('.tour-bubble')).toHaveCount(0);
});

test('"Skip" dismisses the tour for good', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.tour-bubble')).toBeVisible();
  await page.click('.tour-skip');
  await expect(page.locator('.tour-bubble')).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#searchBtn') !== null);
  await expect(page.locator('.tour-bubble')).toHaveCount(0);
});

test('keyboard: Tab cycles inside the bubble, Escape skips', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.tour-next')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.tour-skip')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.tour-next')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.tour-bubble')).toHaveCount(0);
});

test('the tour can be replayed from the help dialog', async ({ page, context }) => {
  // a returning visitor (flag already set) gets no tour…
  await context.addInitScript(() => localStorage.setItem('tourSeen', '1'));
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#searchBtn') !== null);
  await expect(page.locator('.tour-bubble')).toHaveCount(0);
  // …until they ask for it again from the help dialog
  await page.click('#helpBtn');
  await expect(page.locator('#helpDlg')).toBeVisible();
  await page.click('#tourReplay');
  await expect(page.locator('#helpDlg')).toBeHidden();
  await expect(page.locator('.tour-bubble')).toBeVisible();
  await expect(page.locator('.tour-counter')).toHaveText('Step 1 of 4');
});
