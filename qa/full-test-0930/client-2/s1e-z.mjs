// Оплата визита (F-14-094…098, 102, 074). Подготовка: клиент подтверждает запись (ключ core:bookings
// появляется в localStorage), затем одна сегодняшняя запись Nuri получает статус «Пришёл» и клиента приложения.
import { start, newPage, go, shot, text } from './h.mjs';

const { browser, done } = await start();
const log = (...a) => console.log(...a);
const one = (s, n = 600) => (s ?? '').slice(0, n).replace(/\n+/g, ' | ');
const body = (p) => p.locator('body').innerText();
try {
  const { page, errors } = await newPage(browser, { device: 'phone' });
  const zsnap = async (label) => {
    await go(page, '/biz/apps/reports', 'owner');
    await page.getByRole('tab', { name: 'Z-отчёт' }).click();
    await page.waitForTimeout(1500);
    const pc = page.locator('main').getByRole('combobox').last();
    const zt = await text(page);
    log(label, one(zt.slice(zt.indexOf('Итого')), 110), '| pager:', (zt.match(/\d+–\d+ из \d+/) || [''])[0]);
  };
  await zsnap('Z BEFORE:');
  await go(page, '/bookings/bk_0081', 'client');
  const cb = page.getByRole('button', { name: 'Подтвердить, что приду' });
  if (await cb.count()) { await cb.click(); await page.waitForTimeout(2000); }
  const prep = await page.evaluate(() => {
    const key = 'bp-mock-db:core:bookings';
    const raw = localStorage.getItem(key);
    if (!raw) return { err: 'no key', keys: Object.keys(localStorage).filter((k) => k.startsWith('bp-')).slice(0, 40) };
    const j = JSON.parse(raw);
    const arr = Array.isArray(j) ? j : j.state ?? j.items ?? j.data;
    if (!Array.isArray(arr)) return { err: 'shape', shape: Object.keys(j).slice(0, 10) };
    const me = arr.find((b) => b.id === 'bk_0081');
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const t = arr.find((b) => b.businessId === 'biz_nuri' && String(b.start).startsWith(today) && ['scheduled', 'client_confirmed'].includes(b.status));
    if (!t) return { err: 'no today', today, n: arr.length };
    t.status = 'arrived';
    t.appUserId = me?.appUserId;
    t.visitorName = 'Визит QA';
    localStorage.setItem(key, JSON.stringify(j));
    return { ok: t.id, appUser: me?.appUserId, total: t.total };
  });
  log('PREP:', JSON.stringify(prep));
  if (!prep.ok) throw new Error('prep failed');

  await go(page, '/biz/apps/visit', 'owner');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  // Найти «Визит QA» по страницам
  for (let i = 0; i < 4; i++) {
    if (await page.getByText('Визит QA').count()) break;
    const next = page.getByRole('button', { name: 'Следующая страница' });
    if (!(await next.count()) || (await next.isDisabled())) break;
    await next.click();
    await page.waitForTimeout(800);
  }
  await page.getByText('Визит QA').first().click();
  await page.waitForTimeout(1500);
  const dlg = page.getByRole('dialog');
  log('MODAL:', one(await dlg.innerText(), 400));
  await dlg.getByRole('tab', { name: 'Оплата' }).click();
  await page.waitForTimeout(800);
  log('PAY:', one(await dlg.innerText(), 900));
  await shot(page, 'v-pay');
  const amt = dlg.getByLabel('Сумма');
  await amt.fill('1000');
  const payBtn = dlg.getByRole('button', { name: /Оплатить|Принять оплату/ }).last();
  await payBtn.click();
  await page.waitForTimeout(1500);
  log('after partial:', one(await dlg.innerText(), 900));
  await dlg.getByRole('button', { name: 'Карта' }).click().catch((e) => log('card', e.message.split('\n')[0]));
  await page.waitForTimeout(400);
  log('card view:', one(await dlg.innerText(), 900));
  await dlg.getByRole('button', { name: 'Вся сумма' }).click().catch((e) => log('full', e.message.split('\n')[0]));
  await page.waitForTimeout(300);
  await payBtn.click().catch((e) => log('pay2', e.message.split('\n')[0]));
  await page.waitForTimeout(1500);
  log('after full:', one(await dlg.innerText(), 1000));
  await shot(page, 'v-paid');
  const refund = dlg.getByRole('button', { name: 'Возврат' }).first();
  if (await refund.count()) { await refund.click(); await page.waitForTimeout(1500); log('after refund:', one(await dlg.innerText(), 1000)); }
  const send = dlg.getByRole('button', { name: 'Отправить клиенту' });
  if (await send.count()) { await send.click(); await page.waitForTimeout(1500); log('receipt toast:', (await body(page)).includes('Квитанция отправлена')); }
  await shot(page, 'v-refund');
  await page.keyboard.press('Escape');
  await zsnap('Z AFTER PAY:');
  log('STOP'); await done(); process.exit(0);
  // Лояльность
  await dlg.getByRole('tab', { name: /Лояльность/ }).click();
  await page.waitForTimeout(1000);
  log('LOY:', one(await dlg.innerText(), 700));
  const issue = dlg.getByRole('button', { name: 'Выдать карту' });
  if (await issue.count()) { await issue.click(); await page.waitForTimeout(1500); log('issue toast:', (await body(page)).match(/Карта \S+ выдана/)?.[0]); }
  await shot(page, 'v-loyalty');
  // Пуш
  await dlg.getByRole('button', { name: 'Написать клиенту' }).click();
  await page.waitForTimeout(500);
  await dlg.getByPlaceholder('Текст сообщения…').fill('QA push привет');
  await dlg.getByRole('button', { name: 'Отправить', exact: true }).click();
  await page.waitForTimeout(1500);
  log('push toast:', (await body(page)).includes('Отправлено в приложение клиента'));
  await page.keyboard.press('Escape');
  // Клиент видит пуш и карту
  await go(page, '/notifications', 'client');
  log('client sees push:', (await text(page)).includes('QA push привет'));
  // Включить новости Ани Саргсян (мастер Nuri) — появится ли личное сообщение?
  await go(page, '/profile/notifications', 'client');
  const row = page.locator('main li').filter({ hasText: 'Ани Саргсян' });
  const sw = row.getByRole('switch');
  log('Ани news switch before:', await sw.getAttribute('aria-checked'));
  if ((await sw.getAttribute('aria-checked')) === 'false') { await sw.click(); await page.waitForTimeout(1500); }
  await go(page, '/notifications', 'client');
  log('client sees push after unmute:', (await text(page)).includes('QA push привет'));
  await shot(page, 'v-client-push');
  await go(page, '/loyalty-cards', 'client');
  log('CLIENT CARDS:', one(await text(page), 500));
  // Z-отчёт владельца видит оплату картой?
  await go(page, '/biz/apps/reports', 'owner');
  await page.getByRole('tab', { name: 'Z-отчёт' }).click();
  await page.waitForTimeout(1200);
  const zt = await text(page);
  log('Z has Визит QA:', zt.includes('Визит QA'), one(zt.slice(zt.indexOf('Итого')), 200));
  await shot(page, 'v-z');
  log('ERRORS:', errors.slice(0, 6));
} catch (e) {
  console.error('FAIL', e.message);
} finally {
  await done();
}
