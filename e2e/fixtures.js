// Shared Playwright test for the existing suites: the first-visit guided
// tour (#229) is pre-dismissed via its localStorage flag before any page
// script runs, so the tour overlay never interferes with these scenarios.
// The tour's own suite (tour.spec.js) imports @playwright/test directly to
// exercise the real first-visit behavior.
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      try { localStorage.setItem('tourSeen', '1'); } catch { /* ignore */ }
    });
    await use(context);
  }
});
export { expect };

// The secondary topbar actions (export, share, compare, language, theme…)
// live in the "⋯" overflow menu (#266). Shared helpers so every suite
// reveals/dismisses the menu the same way instead of duplicating the dance.
export async function openMoreMenu(page) {
  if (await page.locator('#moreMenu').isHidden()) await page.click('#moreBtn');
  await expect(page.locator('#moreMenu')).toBeVisible();
}
export async function closeMoreMenu(page) {
  if (await page.locator('#moreMenu').isVisible()) await page.click('#moreBtn');
  await expect(page.locator('#moreMenu')).toBeHidden();
}
// language switches go through the menu; it stays open for chained switches
export async function selectLang(page, lang) {
  await openMoreMenu(page);
  await page.selectOption('#langSel', lang);
}
