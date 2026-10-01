// gaps-2: видит ли мастер карточку клиента, которого нет в его «только своих»
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const out = {};
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(`${BASE}/biz/clients?demo=master&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  out.head = (await page.locator('main').innerText()).match(/\d+ клиент[а-я]*/)?.[0];
  const search = page.locator('main input[placeholder*="номер карты"]').first();
  const found = {};
  for (let i = 1; i <= 60; i++) {
    const id = `cl_${String(i).padStart(3, '0')}`;
    const p2 = await page.context().newPage();
    await p2.goto(`${BASE}/biz/clients/${id}?demo=master&lang=ru`, { waitUntil: 'networkidle' });
    await p2.waitForTimeout(500);
    const name = await p2.locator('h1').first().innerText().catch(() => null);
    await p2.close();
    if (!name) { found[id] = 'no card'; continue; }
    await search.fill(name);
    await page.waitForTimeout(1500);
    const txt = await page.locator('main').innerText();
    found[id] = { name, inMasterList: txt.includes(name) };
    if (!txt.includes(name)) { out.foreignOpened = { id, name }; break; }
  }
  out.found = found;
  if (out.foreignOpened) {
    const p3 = await page.context().newPage();
    await p3.goto(`${BASE}/biz/clients/${out.foreignOpened.id}?demo=master&lang=ru`, { waitUntil: 'networkidle' });
    await p3.waitForTimeout(800);
    await p3.screenshot({ path: 'qa/shots/clients-gaps2/master-foreign-card.png' });
    out.foreignCardText = (await p3.locator('main').innerText()).split('\n').filter(Boolean).slice(0, 25).join(' | ').slice(0, 900);
  }
} finally {
  await browser.close();
  release();
}
console.log(JSON.stringify(out, null, 2));
