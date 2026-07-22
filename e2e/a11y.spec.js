// Strict WCAG accessibility audit (#278). Every significant UI state is
// scanned with axe-core at its most demanding setting: all WCAG tags up to
// AAA plus the best-practice ruleset, and any violation fails the run.
// The audit hardens the partial A/AA scan introduced with #64.
import { test as base, expect } from '@playwright/test';
import { test, openMoreMenu, openCritSection } from './fixtures.js';

const ALL_TAGS = ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

// Justified exceptions to the strict ruleset — keep this list minimal and
// documented; never disable a rule without a reason next to it.
const DISABLED_RULES = [
  // WCAG 1.4.6 (AAA, 7:1 contrast): the muted helper texts and the accent
  // color on the dark/light themes meet AA (4.5:1) by design; pushing every
  // secondary shade to 7:1 would erase the visual hierarchy between primary
  // and secondary content. AA contrast (color-contrast) stays enforced.
  'color-contrast-enhanced'
];

async function waitForApp(page) {
  await page.waitForFunction(() => document.querySelectorAll('#mainBiomes .row select option').length > 0);
}

// Runs axe with every WCAG tag + best-practice and asserts zero violations,
// reporting rule id, impact and the offending targets on failure.
async function auditA11y(page, label) {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const results = await new AxeBuilder({ page })
    .withTags(ALL_TAGS)
    .disableRules(DISABLED_RULES)
    .analyze();
  const report = results.violations.map((v) =>
    `[${v.impact}] ${v.id}: ${v.help}\n` +
    v.nodes.map((n) => `  - ${n.target.join(' ')}`).join('\n')
  ).join('\n');
  expect(results.violations, `${label}: ${results.violations.length} violation(s)\n${report}`).toEqual([]);
}

test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
});

test('page load is violation-free in both themes', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  for (const theme of ['dark', 'light']) {
    await page.evaluate((th) => { document.documentElement.dataset.theme = th; }, theme);
    await auditA11y(page, `page load, ${theme} theme`);
  }
});

test('open "⋯" menu is violation-free in both themes', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await openMoreMenu(page);
  for (const theme of ['dark', 'light']) {
    await page.evaluate((th) => { document.documentElement.dataset.theme = th; }, theme);
    await auditA11y(page, `more menu, ${theme} theme`);
  }
});

test('help dialog is violation-free', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.click('#helpBtn');
  await expect(page.locator('#helpDlg')).toBeVisible();
  await auditA11y(page, 'help dialog');
});

test('gallery dialog is violation-free', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await openMoreMenu(page);
  await page.click('#galleryBtn');
  await expect(page.locator('#galleryDlg')).toBeVisible();
  await auditA11y(page, 'gallery dialog');
});

test('criteria panel with an opened optional section is violation-free', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await openCritSection(page, '#addPct');
  await page.click('#addPct');
  await expect(page.locator('#pctClauses .row')).toHaveCount(1);
  await auditA11y(page, 'criteria panel, percentage section open');
});

test('search results with the result popup open are violation-free', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.click('#searchBtn');
  await page.waitForFunction(() => {
    const el = document.querySelector('#searchInfo');
    return el.textContent.length > 0 && !el.classList.contains('busy');
  }, { timeout: 90000 });
  await expect(page.locator('#popup')).toBeVisible();
  await auditA11y(page, 'search results + popup');
});

test('compare mode is violation-free', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await openMoreMenu(page);
  const mainVer = await page.locator('#mcver').inputValue();
  const other = await page.$eval('#cmpVer', (sel, cur) =>
    [...sel.options].map((o) => o.value).find((v) => v && v !== cur), mainVer);
  await page.selectOption('#cmpVer', other);
  await expect(page.locator('#cmpSwap')).toBeVisible();
  await auditA11y(page, 'compare mode armed');
});

// First-visit guided tour: uses the raw Playwright test (no fixtures) so
// localStorage has no tourSeen flag and the tour really shows up.
base('guided tour overlay is violation-free', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.tour-bubble')).toBeVisible();
  await auditA11y(page, 'guided tour');
});

test.describe('mobile viewport 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('mobile page load is violation-free', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await auditA11y(page, 'mobile page load');
  });

  test('mobile help dialog is violation-free', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await page.click('#helpBtn');
    await expect(page.locator('#helpDlg')).toBeVisible();
    await auditA11y(page, 'mobile help dialog');
  });
});
