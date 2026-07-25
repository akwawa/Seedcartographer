// #325: lightweight isometric 3D terrain view — opened from the "⋯" menu,
// the panel renders the visible map area as colored columns on a plain 2D
// canvas. The spec checks the full loop: open → non-uniform pixels drawn,
// 90° rotation re-renders, height-scale change re-renders, close.
import { test, expect, openMoreMenu } from './fixtures.js';

async function waitForApp(page) {
  await page.waitForFunction(() => document.querySelectorAll('#mainBiomes .row select option').length > 0);
}

// distinct colors on the canvas mid-row: > 2 means real terrain was painted
// (background + at least two different column tints)
async function distinctColors(page) {
  return page.$eval('#view3dCanvas', (c) => {
    if (!c.width || !c.height) return 0;
    const d = c.getContext('2d').getImageData(0, Math.floor(c.height / 2), c.width, 1).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return seen.size;
  });
}

async function waitForTerrain(page) {
  await page.waitForFunction(() => {
    const c = document.querySelector('#view3dCanvas');
    if (!c || !c.width || !c.height) return false;
    const d = c.getContext('2d').getImageData(0, Math.floor(c.height / 2), c.width, 1).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return seen.size > 2;
  });
}

test('the 3D view opens, rotates, rescales, exports and closes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await waitForApp(page);

  // open from the "⋯" menu: the dialog shows and the terrain renders
  await openMoreMenu(page);
  await page.click('#view3dBtn');
  await expect(page.locator('#view3dDlg')).toBeVisible();
  await waitForTerrain(page);
  expect(await distinctColors(page)).toBeGreaterThan(2);

  // a 90° rotation re-renders without crashing
  const before = await page.$eval('#view3dCanvas', (c) => c.toDataURL());
  await page.click('#view3dRotR');
  await waitForTerrain(page);
  const rotated = await page.$eval('#view3dCanvas', (c) => c.toDataURL());
  expect(rotated).not.toEqual(before);
  await page.click('#view3dRotL');
  await waitForTerrain(page);

  // the height-scale select re-renders too
  await page.selectOption('#view3dScale', '2');
  await waitForTerrain(page);
  expect(await distinctColors(page)).toBeGreaterThan(2);

  // export PNG produces a download
  const dl = page.waitForEvent('download');
  await page.click('#view3dPng');
  expect((await dl).suggestedFilename()).toMatch(/view3d.*\.png$/);

  // the close button dismisses the dialog; no page error along the way
  await page.click('#view3dClose');
  await expect(page.locator('#view3dDlg')).toBeHidden();
  expect(errors).toEqual([]);
});
