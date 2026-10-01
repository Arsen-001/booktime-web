import { start, stop, open, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/notifications`, { device: 'desktop' });
const sws = async () => page.getByRole('switch').evaluateAll(els=>els.map(e=>[e.getAttribute('aria-label'), e.getAttribute('aria-checked')]).filter(x=>x[0]));
let s = await sws(); console.log('switches', s.length, 'on', s.filter(x=>x[1]==='true').length, 'off', JSON.stringify(s.filter(x=>x[1]!=='true').map(x=>x[0])));
let d = await db(page); console.log('types keys', Object.keys(d.areas.notify.types).length, JSON.stringify(Object.entries(d.areas.notify.types).filter(([k,v])=>v.enabled===false).map(([k])=>k)));
for (const g of ['Администратору', 'Сотруднику', 'Клиенту']) { await page.getByRole('radio', { name: g, exact: true }).click(); await page.waitForTimeout(700); const t = await text(page); const rows = (await sws()).length; console.log(g, 'rows', rows, '| headers:', ['Увеличение посещаемости','Администратору\n','Сотруднику\n','Администратору и сотруднику'].map(h=>h.trim()+':'+t.includes(h)).join(' ')); }
await page.getByRole('radio', { name: 'Все', exact: true }).click(); await page.waitForTimeout(500);
// toggle 'Запрос подтверждения записи' on, reload
await page.getByRole('switch', { name: /Запрос подтверждения записи/ }).click(); await page.waitForTimeout(1500); console.log('toasts', await toasts(page));
await reload(page); console.log('after reload', await page.getByRole('switch', { name: /Запрос подтверждения записи/ }).getAttribute('aria-checked'));
await stop();
