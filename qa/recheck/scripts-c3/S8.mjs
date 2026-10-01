import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('master', '/biz/schedule');
const t = await text(page); console.log('master grid:', t.split('\n').filter(l => /Сотрудники \(|Саргсян|Петросян|Григорян|Оганесян/.test(l)).slice(0, 6));
await go(page, '/biz/journal'); const j = await text(page); console.log('master journal columns:', ['Ани Саргсян', 'Мариам Петросян', 'Сона Григорян', 'Гаяне Оганесян'].map(n => n + '=' + j.includes(n)).join(' '));
await as(page, 'owner', '/biz/schedule/slots'); await pick(page, page.getByRole('combobox').filter({ hasText: /Без перерыва/ }).first(), '10 мин'); await page.waitForTimeout(1200); console.log('toasts', await toasts(page));
await go(page, '/biz/schedule/history'); console.log('history after slot rule change:', (await text(page)).split('\n').slice(0, 10).join(' | '));
await stop();
