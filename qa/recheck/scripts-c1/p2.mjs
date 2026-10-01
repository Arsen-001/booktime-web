import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
const { page } = await open('platform', '/platform/connect', { device: 'desktop' });
await page.getByRole('button', { name: 'Начать подключение' }).click(); await page.waitForTimeout(600);
await page.locator('input[placeholder]').first().fill('Салон Сфера6');
await page.locator('input[placeholder="00 123 456"]').fill('10203091');
const sph = page.locator('select').filter({ has: page.locator('option', { hasText: 'Барбер' }) });
log('sphere selects', await sph.count());
await sph.first().selectOption({ label: 'Маникюр' });
const next = () => page.getByRole('button', { name: 'Далее' }).click().then(()=>page.waitForTimeout(900));
for (let k = 0; k < 8; k++) {
  const t = await text(page);
  if (/Отметьте, какие услуги/.test(t)) { await page.getByText('Маникюр классический').first().click(); await page.waitForTimeout(400); log('services step', t.split('Промокод')[1]?.slice(0,300).replace(/\n/g,' | ')); }
  if (/Часы работы\n/.test(t.split('Промокод')[1] ?? '')) { log('hours step', t.split('Промокод')[1]?.slice(0, 300).replace(/\n/g,' | ')); break; }
  await next();
}
const dr = (await db(page)).areas.platform.connectDrafts; log('draft hours', JSON.stringify(Object.values(dr).at(-1)?.hours), 'services', JSON.stringify(Object.values(dr).at(-1)?.services));
await next();
const tf=Date.now(); await page.getByRole('button', { name: /Готово — подключить/ }).click(); await page.getByText(/Салон подключ/).first().waitFor({ timeout: 60000 }).then(()=>log('finish toast after ms', Date.now()-tf)).catch(()=>log('no finish toast in 60s')); await page.waitForTimeout(1000);
await go(page, '/search?demo=client');
const d = await db(page);
const b = d.core.businesses.find(x=>x.name==='Салон Сфера6');
log('biz', b?.sphereIds, 'services', JSON.stringify(d.core.services.filter(s=>s.businessId===b?.id).map(s=>[s.name.ru, s.staffIds.length, s.onlineBookable])));
log('sched', JSON.stringify(d.core.schedules.filter(s=>d.core.staff.some(st=>st.id===s.staffId && st.businessId===b?.id)).map(s=>s.week)));
const st = d.core.staff.find(x=>x.businessId===b?.id);
await go(page, `/book?staff=${st.id}&demo=client`); 
log('book page', page.url(), (await text(page)).slice(0,700).replace(/\n/g,' | '));
const sun = page.getByRole('button', { name: /27 сентября|вс, 27/ }); log('sunday btn', await sun.count()); log('svc obj', JSON.stringify(d.core.services.filter(s=>s.businessId===b?.id)), 'staff', JSON.stringify(st));
if (await sun.count()) { await sun.first().click(); await page.waitForTimeout(800); log('sunday slots', (await page.getByRole('button', { name: /^\d\d:\d\d$/ }).allInnerTexts()).join(' ')); }
log('ERR', page.errors.slice(0,3));
await stop();
