import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
await start();
const { page } = await open('master', '/biz/schedule', { device: 'desktop' });
log('master rows', (await page.locator('tbody tr').allInnerTexts()).map(r=>r.split('\n').filter(Boolean)[1]), (await text(page)).match(/Сотрудники \(\d+\)/)?.[0]);
const d = await db(page);
log('who is master persona?', JSON.stringify(d.core.staff.filter(s=>s.businessId==='biz_nuri' && s.role==='master').map(s=>[s.id,s.name])));
await go(page, '/biz/schedule/calendar');
{ const t = await text(page); const i = t.indexOf('пятница, 25'); log('--- fri..sun\n' + t.slice(i, i + 1400)); }
log('ERR', page.errors.slice(0,3));
await stop();
