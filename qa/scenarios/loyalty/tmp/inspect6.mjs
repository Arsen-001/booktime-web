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
    const areas = db.state.areas;
    const clients = areas.clients?.clients || areas.clients?.list || [];
    return { keys: Object.keys(areas.clients||{}), clientsLen: Array.isArray(clients)?clients.length:'notarr', c2: (Array.isArray(clients)?clients:Object.values(clients)).find(c=>c.id==='cl_002') };
  });
  console.log(JSON.stringify(result,null,2).slice(0,2000));
} finally { await browser.close(); release(); }
