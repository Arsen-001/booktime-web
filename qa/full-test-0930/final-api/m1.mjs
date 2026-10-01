import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const B = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const r = {};
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: 'bt_data', value: 'mock', domain: 'localhost', path: '/' }]);
  const page = await ctx.newPage();
  await page.goto(`${B}/biz/finance?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' }); await page.waitForTimeout(3000);
  r.before = (await page.innerText('main')).match(/поступления сегодня\s*\n?[^\n]*/)?.[0];
  await page.goto(`${B}/biz/journal`, { waitUntil: 'networkidle' }); await page.waitForTimeout(3000);
  const id = 'bk_1883'; r.id = id;
  await page.goto(`${B}/biz/journal?booking=${id}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(3500);
  const dlg = page.locator('[role=dialog]').last();
  await dlg.getByRole('button', { name: /^Оплатить/ }).last().click(); await page.waitForTimeout(1500);
  r.pay = (await page.locator('[role=dialog]').last().innerText()).slice(0, 200);
  await page.locator('[role=dialog]').last().getByRole('button', { name: /Наличные/ }).click(); await page.waitForTimeout(2500);
  await page.goto(`${B}/biz/finance`, { waitUntil: 'networkidle' }); await page.waitForTimeout(3000);
  r.after = (await page.innerText('main')).match(/поступления сегодня\s*\n?[^\n]*/)?.[0];
  r.top = (await page.innerText('main')).split('Остаток в кассе')[1]?.slice(0, 300);
} catch (e) { r.ERR = String(e).slice(0, 400); }
finally { await browser.close(); release(); }
console.log(JSON.stringify(r, null, 1));
