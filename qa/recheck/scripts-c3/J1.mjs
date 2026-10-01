import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/journal');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'J1-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
const d = await db(page);
const today = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const aniToday = d.core.bookings.filter(b => b.staffId === 'st_nuri_ani' && b.start.startsWith(today)).sort((a, b) => a.start.localeCompare(b.start));
console.log('ani today', aniToday.map(b => b.id + ' ' + b.start + ' ' + b.status + ' ' + b.clientId));
const target = aniToday[0];
await step('booking-param', async () => {
  const c = d.core.clients.find(x => x.id === target.clientId);
  await go(page, '/biz/journal?booking=' + target.id);
  await page.waitForTimeout(1500);
  const dlg = page.locator('[role=dialog]'); console.log('dialog count', await dlg.count(), (await dlg.count()) ? (await dlg.last().innerText()).replace(/\n/g, ' | ').slice(0, 300) : '', '| expected client', c?.name);
  await shot(page, 'J1-booking-param');
});
await step('favorites-star', async () => {
  await go(page, '/biz/journal');
  const star = page.getByRole('button', { name: /избранн/i }).first(); console.log('star', await star.count(), await star.getAttribute('aria-label').catch(()=>null), await star.getAttribute('aria-pressed').catch(()=>null));
  await star.click(); await page.waitForTimeout(800);
  await reload(page);
  const t = await T(3000); const i = t.indexOf('Избранное'); console.log('after reload fav:', t.slice(i, i + 120).replace(/\n/g, ' | '));
});
await step('overlap', async () => {
  await go(page, '/biz/journal');
  await page.getByRole('button', { name: 'Новая запись' }).click(); await page.waitForTimeout(1200);
  const dlg = page.locator('[role=dialog]').last();
  await pick(page, dlg.getByRole('combobox').first(), 'Ани Саргсян');
  const hhmm = target.start.slice(11, 16);
  const tb = dlg.getByRole('button', { name: /^\d{1,2}:\d{2}$/ }).first(); console.log('time btn', await tb.innerText());
  await tb.click(); await page.waitForTimeout(600);
  const opt = page.getByRole('option', { name: hhmm, exact: true }).or(page.getByRole('button', { name: hhmm, exact: true }));
  console.log('opt count', await opt.count()); if (await opt.count()) { await opt.last().click(); await page.waitForTimeout(400); }
  console.log('start now', await dlg.getByRole('button', { name: /^\d{1,2}:\d{2}$/ }).first().innerText());
  await dlg.getByText('Маникюр классический').first().click().catch(e => console.log('svc click fail')); await page.waitForTimeout(400);
  await dlg.getByPlaceholder(/\d\d \d{3}/).first().fill('91 777 888'); await page.waitForTimeout(400);
  const n0 = (await db(page)).core.bookings.length;
  await dlg.getByRole('button', { name: /^Записать$/ }).click(); await page.waitForTimeout(1800);
  console.log('toasts', await toasts(page), 'dialog open?', await page.locator('[role=dialog]').count());
  const n1 = (await db(page)).core.bookings.length; console.log('bookings', n0, '→', n1);
  const nb = (await db(page)).core.bookings.slice(-1)[0]; console.log('last', nb.id, nb.staffId, nb.start, nb.end ?? nb.duration);
  await shot(page, 'J1-overlap');
});
await step('master-records', async () => {
  await as(page, 'master', '/biz/records');
  const t = await T(30000); const staffNames = ['Ани Саргсян', 'Мариам Петросян', 'Сона Григорян', 'Гаяне Оганесян']; console.log('master records mentions:', staffNames.map(n => n + '=' + (t.split(n).length - 1)).join(', '));
  console.log(t.split('\n').slice(0, 6).join(' | '));
});
await stop();
