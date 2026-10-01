// gaps-2 (проверяющий пропусков, круг 2): ФИО на карточке, имя в списке у администратора, карточка чужого клиента у мастера,
// ссылки на записи из карточки, окно рассылки
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const SHOTS = 'qa/shots/clients-gaps2';
const out = {};
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
  out.cards = [];
  for (const id of ['cl_002', 'cl_004', 'cl_006']) {
    await page.goto(`${BASE}/biz/clients/${id}?demo=owner&lang=ru`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const h = await page.locator('h1').first().innerText().catch(() => null);
    const prof = await page.locator('[data-f~="F-04-106"], [data-f*="F-04-046"]').first().innerText().catch(() => null);
    const top = (await page.locator('main').innerText()).split('\n').slice(0, 8).join(' | ');
    out.cards.push({ id, h1: h, prof, top });
  }
  await page.screenshot({ path: `${SHOTS}/card-owner.png` });
  // Ссылки на записи из карточки
  out.bookingLinks = await page.locator('a[href*="/biz/journal?booking="]').evaluateAll((as) => as.slice(0, 4).map((a) => a.getAttribute('href')));
  // Администратор: имя в списке
  await page.goto(`${BASE}/biz/clients?demo=admin&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  out.adminListTop = (await page.locator('main').innerText()).split('\n').slice(0, 40).join(' | ').slice(0, 1200);
  // Мастер: сколько в базе и открывается ли карточка клиента, которого у него нет
  await page.goto(`${BASE}/biz/clients?demo=master&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  out.masterFound = (await page.locator('main').innerText()).match(/Найдено[^\n]*/)?.[0] ?? null;
  const masterIds = await page.locator('a[href^="/biz/clients/cl_"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href').split('?')[0].split('/').pop()))]);
  out.masterVisibleSample = masterIds.slice(0, 5);
  let foreign = null;
  for (let i = 1; i <= 90 && !foreign; i++) {
    const id = `cl_${String(i).padStart(3, '0')}`;
    if (!masterIds.includes(id)) foreign = id;
  }
  out.foreignTried = foreign;
  await page.goto(`${BASE}/biz/clients/${foreign}?demo=master&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  out.masterForeignCard = (await page.locator('main').innerText()).split('\n').slice(0, 12).join(' | ').slice(0, 600);
  await page.screenshot({ path: `${SHOTS}/master-foreign-card.png` });
  out.consoleErrors = errors.slice(0, 8);
} finally {
  await browser.close();
  release();
}
console.log(JSON.stringify(out, null, 2));
