// «Я оплатил» → «Ждёт мастера», 12 ч AM/PM, телефон «abc» в «Команде», подтверждение отмены события, en-имена (client-2-fix)
import { start, newPage, go, text } from '../client-2/h.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/client-2-fix';
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` });
const one = (s, n = 500) => (s ?? '').slice(0, n).replace(/\n+/g, ' | ');
const { browser, done } = await start();
try {
  const { page, errors } = await newPage(browser, { device: 'phone' });
  await go(page, '/bookings/bk_0081', 'client');
  const cb = page.getByRole('button', { name: 'Подтвердить, что приду' });
  if (await cb.count()) { await cb.click(); await page.waitForTimeout(2000); }
  const prep = await page.evaluate(() => {
    const key = 'bp-mock-db:core:bookings';
    const j = JSON.parse(localStorage.getItem(key));
    const arr = Array.isArray(j) ? j : j.state ?? j.items ?? j.data;
    const me = arr.find((b) => b.id === 'bk_0081');
    const t = arr.find((b) => b.appUserId === me.appUserId && b.id !== me.id && b.start > new Date().toISOString().slice(0, 16) && ['scheduled', 'client_confirmed'].includes(b.status));
    if (!t) return { err: 'none' };
    t.status = 'awaiting_prepayment'; t.prepayment = { amount: 2000, paid: false, holdUntil: t.start };
    localStorage.setItem(key, JSON.stringify(j));
    return { ok: t.id };
  });
  console.log('PREP', JSON.stringify(prep));
  await go(page, `/bookings/${prep.ok}`, 'client');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  console.log('before badge has Ждёт предоплату:', (await text(page)).includes('Ждёт предоплату'));
  await page.getByRole('button', { name: 'Я оплатил' }).click(); await page.waitForTimeout(2000);
  const after = await text(page);
  console.log('after: Ждёт мастера', after.includes('Ждёт мастера'), '| Ждёт предоплату', after.includes('Ждёт предоплату'));
  await shot(page, 'client-awaiting-master-phone');
  await go(page, '/bookings', 'client');
  console.log('list has Ждёт мастера:', (await text(page)).includes('Ждёт мастера'));
  // 12 часов
  await go(page, '/profile', 'client');
  const sel = page.getByRole('combobox').filter({ hasText: /24/ }).first();
  if (await sel.count()) { await sel.click(); await page.getByRole('option', { name: /12/ }).click(); await page.waitForTimeout(1500); }
  await go(page, '/bookings', 'client');
  const bt = await text(page);
  console.log('12h ru bookings:', (bt.match(/\d{1,2}:\d{2}( [AP]M)?/g) ?? []).slice(0, 5).join(', '), 'вечера?', bt.includes('вечера') || bt.includes('утра'));
  await shot(page, 'client-12h-phone');
  // Команда: телефон abc
  await go(page, '/biz/apps/team', 'owner');
  await page.getByRole('button', { name: 'Добавить сотрудника' }).first().click(); await page.waitForTimeout(800);
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Имя').fill('QA Тест');
  await dlg.getByLabel('Телефон').fill('abc');
  console.log('phone field value after abc:', JSON.stringify(await dlg.getByLabel('Телефон').inputValue()));
  await dlg.getByRole('button', { name: /Создать|Добавить/ }).last().click(); await page.waitForTimeout(800);
  console.log('team dialog after submit:', one(await dlg.innerText(), 300));
  console.log('role options:', one(await dlg.getByRole('combobox').last().innerText(), 100));
  await shot(page, 'team-phone-invalid-phone');
  await page.keyboard.press('Escape');
  // События: отмена с подтверждением
  await go(page, '/biz/apps/events', 'owner');
  const ev = page.locator('main li').first();
  if (await ev.count()) {
    await ev.click(); await page.waitForTimeout(1000);
    const d2 = page.getByRole('dialog');
    console.log('participant labels:', (await d2.innerText()).includes('Имя'), (await d2.innerText()).includes('Цена'));
    await d2.getByRole('button', { name: 'Отменить событие' }).click(); await page.waitForTimeout(800);
    const alert = page.getByRole('alertdialog');
    console.log('confirm shown:', await alert.count(), one(await alert.innerText().catch(() => ''), 200));
    await shot(page, 'events-cancel-confirm-phone');
  }
  // en-имена на главной
  const { page: p2 } = await newPage(browser, { device: 'desktop' });
  await p2.goto('http://localhost:3710/?demo=client&lang=en', { waitUntil: 'domcontentloaded' }); await p2.waitForTimeout(4500);
  console.log('EN home Cyrillic left:', ((await text(p2)).match(/[а-яё]+/gi) ?? []).slice(0, 10).join(' '));
  await shot(p2, 'home-en-desktop');
  console.log('ERRORS', errors.filter((e) => !/favicon/.test(e)).slice(0, 5));
} catch (e) { console.error('FAIL', e.message); } finally { await done(); }
