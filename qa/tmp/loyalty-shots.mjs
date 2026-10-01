import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = process.argv[2] || 'before';
const outDir = '/Users/arsen/WebstormProjects/booking-platform/docs/design/after';

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
];

async function run() {
  const release = await acquireBrowserSlot();
  try {
    const browser = await chromium.launch();
    try {
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await ctx.newPage();

        await page.goto(`${BASE}/biz/loyalty?demo=owner&sphere=nails`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${outDir}/loyalty-hub-${vp.name}-${OUT}.png`, fullPage: true });

        await page.goto(`${BASE}/biz/loyalty/cards`, { waitUntil: 'load' }).catch((e) => console.log('goto err', e.message));
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${outDir}/loyalty-cards-${vp.name}-${OUT}.png`, fullPage: true });

        const row = vp.name === '390' ? page.locator('ul li button').first() : page.locator('table tbody tr').first();
        await row.click({ timeout: 5000, force: true }).catch((e) => console.log('click err', e.message));
        await page.waitForURL(/\/biz\/loyalty\/cards\/.+/, { timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(500);
        if (page.url().includes('/biz/loyalty/cards/')) {
          await page.screenshot({ path: `${outDir}/loyalty-card-detail-${vp.name}-${OUT}.png`, fullPage: true });
        } else {
          console.log('card detail not opened for viewport', vp.name, 'url=', page.url());
        }

        await ctx.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    release();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
