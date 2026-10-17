import { test, expect } from '@playwright/test';

const features  = ['map', 'layers', 'aoi', 'report', 'export'];
const langs     = ['en', 'te', 'hi'];
const viewports = [{ w: 375, h: 812 }, { w: 1440, h: 900 }];
const networks  = ['online', 'slow3g', 'offline', 'api503'] as const;

for (const f of features) for (const l of langs)
for (const v of viewports) for (const n of networks) {
  test(`${f} | ${l} | ${v.w}px | ${n}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => m.type() === 'error' && errors.push(m.text()));

    await page.setViewportSize({ width: v.w, height: v.h });
    if (n === 'api503') await page.route('**/api/**', r => r.fulfill({ status: 503 }));
    if (n === 'offline') await page.context().setOffline(true);

    await page.goto(`/?lang=${l}#${f}`).catch(() => {});
    await page.screenshot({ path: `evidence/${f}-${l}-${v.w}-${n}.png` });

    expect(errors.filter(e => /is not defined/.test(e))).toEqual([]);
    await expect(page.getByRole('alert').filter({ hasText: 'needs to reload' })).toHaveCount(0);
  });
}
