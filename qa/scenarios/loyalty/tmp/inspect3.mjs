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
    const topKeys = Object.keys(db);
    const loyaltyKey = topKeys.find(k => k.toLowerCase().includes('loyal'));
    const clientsKey = topKeys.find(k => k.toLowerCase() === 'clients' || k.toLowerCase().includes('client'));
    const loy = db[loyaltyKey];
    const cards = loy?.cards || [];
    const clients = db[clientsKey]?.clients || db[clientsKey] || [];
    return { topKeys, loyaltyKey, clientsKey, cardsCount: cards.length, cardsSample: cards.slice(0,3), clientsIsArray: Array.isArray(clients), clientsKeysSub: typeof clients === 'object' ? Object.keys(clients).slice(0,5) : null };
  });
  console.log(JSON.stringify(result, null, 2).slice(0,3000));
} finally { await browser.close(); release(); }
