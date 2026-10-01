import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/loyalty/promotions/new?empty=1');
const T = async (n=1200) => (await text(page)).slice(0, n);
const d0 = await db(page); console.log('empty biz promos before', JSON.stringify(Object.keys(d0.areas.loyalty)), d0.areas.loyalty.promotions.length, 'cardTypes', d0.areas.loyalty.cardTypes.length);
console.log('biz', page.url());
await page.locator('main input').first().fill('Акция без карты C3');
for (let i = 0; i < 6; i++) {
  const inp = page.locator('main input[inputmode], main input[type=number]');
  if (await inp.count()) { try { await inp.first().fill('10'); } catch {} }
  console.log("btns", (await page.locator("main button").allInnerTexts()).slice(-5)); const c = page.locator("main button").last();
  const lbl = await c.innerText(); const en = await c.isEnabled();
  console.log('step', i, 'btn', lbl, en, '|', (await T(1600)).split('\n').slice(12, 26).join(' | ').slice(0, 400));
  if (!en) break;
  await c.click(); await page.waitForTimeout(900);
  if (!/promotions\/new/.test(page.url())) break;
}
console.log('url', page.url(), 'toasts', await toasts(page));
await shot(page, 'L5-after');
const d = await db(page); console.log('promos now', d.areas.loyalty.promotions.filter(p => /без карты/.test(p.name)).map(p => JSON.stringify(p).slice(0, 300)));
await go(page, '/biz/loyalty/promotions'); console.log((await T(800)).replace(/\n/g,' | '));
await stop();
