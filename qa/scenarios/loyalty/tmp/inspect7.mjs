import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/clients?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const result = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('bp-mock-db'));
    const core = db.state.core;
    return { coreKeys: Object.keys(core||{}), c: (core.clients||[]).find?.(c=>c.id==='cl_002') };
  });
  console.log(JSON.stringify(result,null,2).slice(0,2000));
} finally { await browser.close(); release(); }
