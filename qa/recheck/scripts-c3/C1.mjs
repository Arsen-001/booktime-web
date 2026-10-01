import { start, stop, open, go, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('client', '/bookings/bk_0081/reschedule', { device: 'phone' });
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'C1-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
const bk = async () => { const d = await db(page); const b = d.core.bookings.find(x => x.id === 'bk_0081'); return JSON.stringify({ start: b.start ?? b.startAt ?? b.date, time: b.time, status: b.status, staff: b.staffId, cancel: b.cancelledBy ?? b.cancelReason }); };
await step('reschedule', async () => {
  console.log('before', await bk());
  await page.getByRole('button', { name: 'вт, 29 сентября' }).click(); await page.waitForTimeout(800);
  const times = page.locator('main button').filter({ hasText: /^\d{1,2}:\d{2}$/ });
  console.log('times on 29:', (await times.allInnerTexts()).join(' '));
  await times.first().click(); await page.waitForTimeout(600);
  console.log('after pick:', (await T(1500)).split('\n').slice(-8).join(' | '));
  const btn = page.getByRole('button', { name: /Перенести|Подтвердить|Сохранить/ }).last();
  await btn.click(); await page.waitForTimeout(1500);
  console.log('toasts', await toasts(page), 'url', page.url());
  if (await page.locator('[role=dialog],[role=alertdialog]').count()) { console.log('dlg', await page.locator('[role=dialog],[role=alertdialog]').last().innerText()); await page.locator('[role=dialog],[role=alertdialog]').last().getByRole('button').last().click(); await page.waitForTimeout(1500); console.log('toasts2', await toasts(page)); }
  console.log('after', await bk());
  await go(page, '/bookings/bk_0081'); console.log((await T(500)).replace(/\n/g, ' | '));
  await shot(page, 'C1-after-reschedule');
});
await step('owner-sees-reschedule', async () => {
  await as(page, 'owner', '/biz/journal?booking=bk_0081');
  console.log((await T(3000)).split('\n').filter(l => /29|сентябр|Перен|перен|15:|Лиана|клиент/i.test(l)).slice(0, 12).join(' | '));
  await shot(page, 'C1-owner-journal-bk0081');
});
await step('cancel', async () => {
  await as(page, 'client', '/bookings/bk_0081');
  await page.getByRole('button', { name: 'Отменить запись' }).click(); await page.waitForTimeout(800);
  const dlg = page.locator('[role=dialog],[role=alertdialog]').last(); console.log('dlg', (await dlg.innerText()).slice(0, 400));
  await dlg.getByRole('button').last().click(); await page.waitForTimeout(1500);
  console.log('toasts', await toasts(page)); console.log('after', await bk());
  await go(page, '/bookings'); await page.getByRole('tab', { name: /Отменённые/ }).click(); await page.waitForTimeout(600); console.log('cancelled tab:', (await T(900)).replace(/\n/g,' | ').slice(0, 500));
  await as(page, 'owner', '/biz/records');
  const t = await T(6000); console.log('records has cancelled row?', t.split('\n').filter(l => /Отмен|отмен/.test(l)).slice(0, 6));
});
await step('repeat', async () => {
  await as(page, 'client', '/bookings');
  await page.getByRole('tab', { name: /Прошедшие/ }).click(); await page.waitForTimeout(700);
  const first = page.locator('main a[href^="/bookings/bk_"]').first(); const href = await first.getAttribute('href'); console.log('past', href, (await first.innerText()).replace(/\n/g,' '));
  await first.click(); await page.waitForTimeout(1500);
  const rep = page.getByRole('link', { name: /Повторить/ }); console.log('repeat href', await rep.getAttribute('href'));
  await rep.click(); await page.waitForTimeout(2500);
  console.log('url', page.url()); console.log((await T(1500)).replace(/\n/g,' | ').slice(0, 800));
  await shot(page, 'C1-repeat');
});
await stop();
