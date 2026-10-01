import { start, stop, open, go, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('client', '/places/biz_nuri', { device: 'phone' });
const T = async (n=1200) => (await text(page)).slice(0, n);
const d0 = await db(page); const st0 = d0.areas.client.stories; console.log('stories', st0.length, JSON.stringify(st0.find(s => s.businessId === 'biz_nuri')).slice(0, 400));
await page.locator('a[href^="/stories/"]').first().click(); await page.waitForTimeout(2000);
console.log('story url', page.url(), (await page.locator('body').innerText()).replace(/\n/g,' | ').slice(0, 400));
const bk = page.getByRole('link', { name: /Записаться/ }).or(page.getByRole('button', { name: /Записаться/ }));
console.log('book btn', await bk.count(), await bk.first().getAttribute('href').catch(()=>null));
await bk.first().click(); await page.waitForTimeout(2500);
console.log('book url', page.url());
for (let i = 0; i < 8; i++) {
  const t = await T(2000); console.log('step', i, t.replace(/\n/g,' | ').slice(0, 300));
  const time = page.locator('main button').filter({ hasText: /^\d{1,2}:\d{2}$/ });
  if (await time.count()) { await time.first().click(); await page.waitForTimeout(500); }
  else if (t.includes('Услуга') && t.includes('Маникюр классический') && i < 2) { await page.getByText('Маникюр классический').first().click(); await page.waitForTimeout(800); }
  else if (/мастера/i.test(t) && !/Выберите время/.test(t) && t.includes('Ани Саргсян')) { await page.getByText('Ани Саргсян').first().click(); await page.waitForTimeout(800); }
  console.log('   btns:', (await page.locator('main button:visible').allInnerTexts()).slice(-4).join(' / ')); const c = page.getByRole('button', { name: /Продолжить|Записаться|Подтвердить|Далее/ }).last();
  if (await c.count() && await c.isEnabled()) { await c.click(); await page.waitForTimeout(1500); }
  if (/bookings\//.test(page.url())) break;
  const tt = await toasts(page); if (tt.length) console.log('toasts', tt);
}
console.log('final url', page.url(), await toasts(page));
const d = await db(page); const nb = d.core.bookings.filter(b => !d0.core.bookings.some(x => x.id === b.id)); console.log('new bookings', nb.map(b => JSON.stringify({ id: b.id, biz: b.businessId, src: b.source, story: b.storyId, start: b.start })));
const s1 = d.areas.client.stories.find(s => s.businessId === 'biz_nuri'); console.log('story after', JSON.stringify(s1).slice(0, 400));
await as(page, 'owner', '/biz/apps/stories'); const t = await T(5000); const i = t.indexOf('Нажатия'); console.log('stats:', t.slice(i - 150, i + 150).replace(/\n/g, ' | '));
await shot(page, 'C6-stories-stats');
await stop();
