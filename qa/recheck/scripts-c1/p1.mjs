import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
const { page } = await open('platform', '/platform/connect', { device: 'desktop' });
const d0 = await db(page);
await page.getByRole('button', { name: 'Начать подключение' }).click(); await page.waitForTimeout(600);
await page.locator('input[placeholder]').first().fill('Перепроверка Салон3');
await page.locator('input[placeholder="00 123 456"]').fill('10203097');
for (let i = 0; i < 8; i++) {
  const body = await text(page);
  const h = body.match(/Шаг \d+ из \d+[^\n]*\n[^\n]*/)?.[0] ?? body.slice(0,120);
  log('STEP', i, h.replace(/\n/g,' | '));
  log('   ', body.slice(0, 900).replace(/\n/g,' | '));
  if (i === 5) await page.getByText('Пн', { exact: true }).first().click().catch(()=>{});
  const next = page.getByRole('button', { name: 'Далее' });
  if (await next.count() && await next.isEnabled()) { await next.click(); await page.waitForTimeout(900); continue; }
  const fin = page.getByRole('button', { name: /Готово — подключить/ });
  if (await fin.count()) { await fin.click(); await page.waitForTimeout(2000); log('finish toast', await toast(page)); break; }
  log('stuck; buttons', (await page.getByRole('button').allInnerTexts()).slice(-8)); break;
}
const d1 = await db(page);
const biz = d1.core.businesses.find(b=>/Перепроверка/.test(JSON.stringify(b.name))); log('nbiz', d0.core.businesses.length, '->', d1.core.businesses.length);
log('biz', JSON.stringify(biz)?.slice(0,400));
if (biz) {
  log('staff', JSON.stringify(d1.core.staff.filter(s=>s.businessId===biz.id).map(s=>[s.id,s.name,s.status,s.calendarVisibility])));
  log('services', JSON.stringify(d1.core.services.filter(s=>s.businessId===biz.id).map(s=>[s.name.ru,s.active,s.onlineBookable,s.staffIds])));
  log('schedules', JSON.stringify(d1.core.schedules.filter(s=>d1.core.staff.some(st=>st.id===s.staffId && st.businessId===biz.id)).map(s=>s.week)));
}
await go(page, '/search?demo=client');
const st = await text(page);
log('search has salon', /Перепроверка Салон/.test(st));
const inp = page.getByPlaceholder('Что ищете?').first(); await inp.fill('Перепроверка'); await inp.press('Enter'); await page.waitForTimeout(2000);
await shot(page, 'p1-search'); log((await text(page)).split('Найден')[1]?.slice(0,300)); log('search query result', (await text(page)).match(/Найден[^\n]*|Никого не нашли/)?.[0]);
const d2 = await db(page);
const b2 = d2.core.businesses.find(b=>/Салон3/.test(JSON.stringify(b)));
log('biz after nav', JSON.stringify(b2)?.slice(0,500));
if (b2) { log('staff', JSON.stringify(d2.core.staff.filter(s=>s.businessId===b2.id).map(s=>[s.id,s.name,s.status,s.sphereIds]))); log('services', JSON.stringify(d2.core.services.filter(s=>s.businessId===b2.id).map(s=>[s.name.ru,s.durationMin,s.priceMin,s.staffIds.length]))); log('sched', JSON.stringify(d2.core.schedules.filter(s=>d2.core.staff.some(st=>st.id===s.staffId&&st.businessId===b2.id)).map(s=>s.week))); }
const mod = d2.areas.platform?.moderation ?? d2.areas.platform?.moderationItems;
log('platform keys', Object.keys(d2.areas.platform||{}));
await go(page, '/?demo=client'); log('home nearby has salon', /Салон3/.test(await text(page)));
log('ERR', page.errors.slice(0,3));
await stop();
