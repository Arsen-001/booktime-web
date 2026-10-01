import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('client', '/book?staff=st_nuri_ani&service=sv_nuri_classic', { device: 'phone' });
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'S1-fail-' + name.replace(/\W+/g,'_')); } };
const DAY = 'вт, 29 сентября', ISO = '2026-09-29';
const times = async () => { await as(page, 'client', '/book?staff=st_nuri_ani&service=sv_nuri_classic'); await page.getByRole('button', { name: DAY }).click(); await page.waitForTimeout(900); return (await page.locator('main button').filter({ hasText: /^\d{1,2}:\d{2}$/ }).allInnerTexts()).join(' '); };
const aniDay = async () => (await db(page)).core.bookings.filter(b => b.staffId === 'st_nuri_ani' && b.start.startsWith(ISO) && !/cancel/.test(b.status)).map(b => b.id + '@' + b.start.slice(11) + '(' + (b.services||[]).reduce((a, s) => a + (s.durationMin||0), 0) + 'm,' + b.status + ')');
let t0;

await step('skipbuf', async () => { return;
  await as(page, 'owner', '/biz/schedule/slots');
  const cb = page.getByRole('combobox').filter({ hasText: /Без перерыва/ }); console.log('cb', await cb.count());
  await pick(page, cb.first(), '20 мин'); await page.waitForTimeout(1200); console.log('toasts', await toasts(page));
  await reload(page); console.log('after reload value:', await page.getByRole('combobox').filter({ hasText: /мин|перерыв/i }).allInnerTexts());
  const t1 = await times(); console.log('slots after 20m buffer:', t1, '| changed?', t1 !== t0);
});
await step('cancel-frees', async () => {
  const d = await db(page); const b = d.core.bookings.filter(b => b.staffId === 'st_nuri_ani' && b.start.startsWith(ISO) && !/cancel|arrived/.test(b.status))[0]; console.log('cancel', b?.id, b?.start);
  const before = await times(); console.log('slots now', before);
  await as(page, 'owner', '/biz/journal?date=2026-09-29&booking=' + b.id);
  const dlg = page.locator('[role=dialog]').last();
  await dlg.getByRole('button', { name: 'Отменил мастер' }).click(); await page.waitForTimeout(500);
  await dlg.getByRole('button', { name: 'Сохранить изменения' }).click(); await page.waitForTimeout(1500);
  const top = page.locator('[role=dialog]').last(); const yes = top.getByRole('button', { name: 'Да', exact: true }); if (await yes.count()) { await yes.click(); await page.waitForTimeout(1200); }
  console.log('toasts', await toasts(page), 'status', (await db(page)).core.bookings.find(x => x.id === b.id).status);
  const after = await times(); console.log('slots after cancel', after, '| contains', b.start.slice(11), after.split(' ').includes(b.start.slice(11).replace(/^0/, '')) || after.split(' ').includes(b.start.slice(11)));
});
await stop();
