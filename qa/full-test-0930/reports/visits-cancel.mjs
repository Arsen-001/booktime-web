// «Визиты»: корзина в ленте → подтверждение → запись пропадает из «Предстоящих», счётчик −1; формат телефона и дня.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';

const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/reports';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = [];
const say = (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); console.log(s); log.push(s); };
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on('pageerror', (e) => say('PAGEERR', e.message.slice(0, 150)));
  await page.goto('http://localhost:3710/biz/reports/visits?demo=owner&lang=ru&sphere=nails', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(6000);
  const count = async () => Number((await page.getByRole('tab', { name: /Предстоящие/ }).innerText()).replace(/\D/g, ''));
  const before = await count();
  const firstEntry = page.locator('section:has(h2:text("Лента активности по записям")) li, section:has(h2:text("Лента активности по записям")) article').first();
  const trash = page.getByRole('button', { name: 'Отменить запись' }).first();
  const entryText = await trash.locator('xpath=ancestor::*[.//p][2]').innerText().catch(() => '');
  say('before', before, 'entry', entryText.slice(0, 200).replace(/\n/g, ' | '));
  await trash.click();
  await page.waitForTimeout(800);
  const dlg = page.getByRole('dialog');
  say('dialog', (await dlg.innerText().catch(() => 'NO DIALOG')).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${OUT}/visits-cancel-confirm.png` });
  await dlg.getByRole('button', { name: 'Отменить запись' }).click();
  await page.waitForTimeout(3500);
  const after = await count();
  say('after', after, 'delta', after - before);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  say('after reload', await count());
  const txt = await page.innerText('main');
  say('head', txt.slice(0, 400).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${OUT}/visits-after-fix.png` });
  void firstEntry;
} finally {
  fs.writeFileSync(`${OUT}/visits-cancel.log`, log.join('\n'));
  await browser.close();
  release();
}
