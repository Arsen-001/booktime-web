import { start, stop, open, as, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('platform', '/platform/connect', { device: 'desktop' });
const btn = page.getByRole('button', { name: /Начать подключение|Подключить новый/ }); if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(600); }
await page.getByPlaceholder('Например: Nail Studio Ева').fill('Перепроверка C2 Салон');
await page.getByText('Маникюр', { exact: true }).first().click();
await page.getByPlaceholder('91 234 567').fill('10203098');
const hoursText = [];
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(500);
  const body = await text(page);
  const h = body.slice(body.indexOf('Итог') + 4, body.indexOf('Итог') + 700).replace(/\n/g,' | ');
  console.log('STEP', i, h.slice(0, 600));
  if (/Мастера\s*\|\s*Кто принимает|Добавьте мастера|мастер/i.test(h) && (await page.getByPlaceholder(/Имя мастера|Например: Ани/).count())) { await page.getByPlaceholder(/Имя мастера|Например: Ани/).first().fill('Тест Мастерова'); const add = page.getByRole('button', { name: /Добавить мастера|Добавить/ }); if (await add.count()) await add.first().click(); }
  if (/Часы/.test(h.slice(0,40))) hoursText.push(h);
  const next = page.getByRole('button', { name: 'Далее' });
  if (await next.count() && await next.isEnabled()) { await next.click(); await page.waitForTimeout(900); continue; }
  const fin = page.getByRole('button', { name: /Готово|Подключить/ }).last();
  console.log('   buttons', (await page.getByRole('button').allInnerTexts()).slice(-8));
  if (await fin.count()) { await fin.click(); await page.waitForTimeout(4000); console.log('finish', await toasts(page)); }
  break;
}
const d = await db(page);
const biz = d.core.businesses.find(b=>/Перепроверка C2/.test(JSON.stringify(b.name)));
console.log('biz', biz?.id, 'staff', JSON.stringify(d.core.staff.filter(s=>s.businessId===biz?.id).map(s=>[s.id,s.name])), 'svc', d.core.services.filter(s=>s.businessId===biz?.id).length);
console.log('sched weeks', JSON.stringify(d.core.schedules.filter(s=>d.core.staff.some(st=>st.id===s.staffId&&st.businessId===biz?.id)).map(s=>s.week)));
if (biz) { const st = d.core.staff.find(s=>s.businessId===biz.id); const sv = d.core.services.find(s=>s.businessId===biz.id);
 await as(page, 'client', '/search'); const inp = page.getByPlaceholder(/Что ищете/).first(); await inp.fill('Перепроверка C2'); await inp.press('Enter'); await page.waitForTimeout(2000); console.log('search', (await text(page)).match(/Перепроверка C2[^\n]*/)?.[0], (await text(page)).match(/Найден[^\n]*|Ничего[^\n]*/)?.[0]);
 await as(page, 'client', `/book?staff=${st.id}&service=${sv.id}`); const bt = await text(page); console.log('BOOK', bt.slice(0,500).replace(/\n/g,' | ')); await shot(page, 'p4-book-new-salon'); }
await stop();
