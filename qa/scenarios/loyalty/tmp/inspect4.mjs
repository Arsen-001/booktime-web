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
    const state = db.state;
    const topKeys = Object.keys(state);
    const loyKey = topKeys.find(k=>k.toLowerCase().includes('loyal'));
    const loy = state[loyKey];
    const cards = (loy && loy.cards) || [];
    // find current business id via clients
    const clientsKey = topKeys.find(k=>k.toLowerCase().includes('client'));
    const clientsState = state[clientsKey];
    return { topKeys, loyKey, loyKeys: loy?Object.keys(loy):null, cardsLen: cards.length, cardsSample: cards.slice(0,3), clientsKey, clientsStateKeys: clientsState?Object.keys(clientsState).slice(0,10):null };
  });
  console.log(JSON.stringify(result,null,2).slice(0,3000));
} finally { await browser.close(); release(); }
