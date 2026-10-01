import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/loyalty?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const result = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('bp-mock-db'));
    const areas = db.state.areas;
    const areaKeys = Object.keys(areas);
    const loy = areas.loyalty;
    const cards = loy?.cards || [];
    const clients = areas.clients?.clients || [];
    // business id from core
    const businessId = db.state.core?.currentBusinessId || db.state.core?.businessId;
    return { areaKeys, businessId, cardsLen: cards.length, cardsSample: cards.filter(c=>c.balance>0).slice(0,3), clientsLen: clients.length, clientSample: clients.slice(0,2) };
  });
  console.log(JSON.stringify(result,null,2).slice(0,4000));
} finally { await browser.close(); release(); }
