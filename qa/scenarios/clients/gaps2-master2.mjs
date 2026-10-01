// gaps-2: мастер ищет «Ани Мелкумян» в своей базе; кто он сам
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto('http://localhost:3710/biz/clients?demo=master&lang=ru', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const s = page.locator('main input[placeholder*="номер карты"]').first();
  console.log('placeholder', await s.getAttribute('placeholder'));
  await s.fill('Мелкумян');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/shots/clients-gaps2/master-search.png' });
  console.log((await page.locator('main').innerText()).slice(0, 700));
  const who = await page.locator('header').first().innerText().catch(() => '');
  console.log('HEADER', who.slice(0, 200));
} finally { await browser.close(); release(); }
