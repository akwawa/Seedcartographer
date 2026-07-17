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
