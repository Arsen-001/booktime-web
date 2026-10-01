import { start, stop, page, shot, setTime, txt, step, BASE } from './lib.mjs';
const log = (...a) => console.log(...a);
const D = '2026-09-30T';
const now = (p) => txt(p.locator('[aria-label="Что происходит сейчас"]'));
const attn = (p) => txt(p.locator('aside[aria-label="Требует внимания"]'));
const dlg = (p) => txt(p.locator('[role="dialog"]:visible').last());
const toast = async (p) => (await p.locator('[data-toast-viewport]').allInnerTexts()).join(' / ').replace(/\n+/g, ' | ');
const block = (p, name) => p.locator('[data-testid="booking-block"]').filter({ hasText: name }).first();
const closeWin = async (p) => { await p.keyboard.press('Escape'); await p.waitForTimeout(1500); };
await start();
try {
  const p = await page({ time: D + '12:20:00+04:00' });
  log('pending hint:', (await attn(p)).match(/(Ответьте|Срок)[^|]*/)?.[0]);
  await setTime(p, D + '13:57:00+04:00');
  log('13:57 now:', await now(p));
  await step('shift +15', async () => {
    await p.getByRole('button', { name: /Ещё действия:/ }).first().click();
    await p.waitForTimeout(600);
    await p.getByRole('menuitem', { name: /Сдвинуть на 15/ }).click();
    await p.waitForTimeout(1500);
    log('TOAST shift:', await toast(p));
  });
  await step('arrive late (panel)', async () => {
    await p.getByRole('button', { name: /^Пришёл: / }).first().click();
    await p.waitForTimeout(1500);
    log('TOAST arrive:', await toast(p));
    log('now after arrive:', await now(p));
  });
  await step('finish early', async () => {
    await p.locator('[aria-label="Что происходит сейчас"] button').filter({ hasText: /ид/ }).first().click();
    await p.waitForTimeout(800);
    log('INPROG POP:', await dlg(p));
    await p.getByRole('button', { name: 'Закончили раньше' }).first().click();
    await p.waitForTimeout(1500);
    log('TOAST finish:', await toast(p));
    await shot(p, 's5-01-finish-toast');
    const offer = p.locator('[data-toast-viewport]').getByRole('button', { name: 'Предложить окно' });
    if (await offer.count()) { await offer.first().click(); await p.waitForTimeout(1500); log('OFFER SHEET:', (await dlg(p)).slice(0, 300)); await closeWin(p); }
  });
  await step('next visit from open window', async () => {
    await block(p, 'Сирануш').click();
    await p.waitForTimeout(3000);
    log('WIN1:', (await dlg(p)).slice(0, 300));
    await p.getByRole('button', { name: 'Записать на следующий визит' }).click();
    await p.waitForTimeout(5000);
    log('URL next', p.url());
    log('NEXT WINDOW:', (await dlg(p)).slice(0, 700));
    await shot(p, 's5-02-next-visit');
    await closeWin(p);
    await p.goto(BASE + '/biz/journal'); await p.waitForTimeout(3000);
  });
  await step('window arrived with required field + draft staleness', async () => {
    await block(p, 'Нуне').click(); await p.waitForTimeout(3000);
    log('Нуне win status before:', (await dlg(p)).match(/Статус визита[^]*?Отменил мастер/)?.[0]);
    await p.locator('[role="dialog"]:visible').getByRole('radio', { name: 'Пришёл' }).first().click().catch(async () => p.locator('[role="dialog"]:visible').getByRole('button', { name: 'Пришёл', exact: true }).first().click());
    await p.waitForTimeout(2000);
    log('TOAST window arrive:', await toast(p));
    await shot(p, 's5-03-window-arrived');
    await closeWin(p);
    log('Нуне block:', (await block(p, 'Нуне').innerText()).replace(/\n+/g, ' | '));
  });
  await step('draft staleness via list', async () => {
    await block(p, 'Шушан').click(); await p.waitForTimeout(3000); await closeWin(p);
    await p.getByText('Список', { exact: true }).first().click(); await p.waitForTimeout(2000);
    await shot(p, 's5-04-list');
    log('LIST:', (await p.locator('main').innerText()).slice(0, 1500).replace(/\n+/g, ' | '));
    const row = p.locator('li, [role="row"], div').filter({ hasText: 'Шушан' }).locator('[data-list-action="arrive"]').first();
    log('Шушан arrive btn', await row.count());
    if (await row.count()) { await row.click(); await p.waitForTimeout(1500); log('TOAST list arrive:', await toast(p)); }
    const pay = p.locator('[data-list-action="pay"]');
    log('pay buttons', await pay.count());
    if (await pay.count()) { await pay.first().click(); await p.waitForTimeout(1500); log('TOAST pay:', await toast(p)); }
    await p.getByText('Колонки', { exact: true }).first().click(); await p.waitForTimeout(1500);
    await block(p, 'Шушан').click(); await p.waitForTimeout(3000);
    const w = await dlg(p);
    log('Шушан window after list-arrive:', w.slice(0, 400));
    await shot(p, 's5-05-shushan-window');
    await closeWin(p);
  });
  await step('confirm tomorrow', async () => {
    await p.getByRole('button', { name: 'Напомнить', exact: true }).first().click();
    await p.waitForTimeout(1500);
    const c = p.locator('[role="dialog"]:visible').getByRole('button', { name: /Подтвердил/ });
    const n0 = await c.count();
    await c.first().click({ timeout: 8000 }).catch(async (e) => { log('click fail -> force', e.message.split('\n')[0]); await c.first().click({ force: true }); });
    await p.waitForTimeout(1500);
    log('confirm', n0, '->', await c.count(), 'TOAST:', await toast(p));
    await closeWin(p);
    log('attn tomorrow:', (await attn(p)).match(/Завтра[^|]*/)?.[0]);
  });
  await step('search', async () => {
    await p.getByRole('button', { name: 'Найти клиента' }).first().click();
    await p.waitForTimeout(1000);
    await p.keyboard.type('Сирануш'); await p.waitForTimeout(2000);
    await shot(p, 's5-06-search');
    log('SEARCH:', (await dlg(p)).slice(0, 500));
    await closeWin(p);
  });
  await step('records filter', async () => {
    await p.goto(BASE + '/biz/records'); await p.waitForTimeout(4000);
    await shot(p, 's5-07-records');
    log('RECORDS:', (await p.locator('main').innerText()).slice(0, 700).replace(/\n+/g, ' | '));
  });
  log('errors owner', p.errors);
  // master persona
  await step('master scope', async () => {
    const m = await page({ persona: 'master', time: D + '12:20:00+04:00' });
    await setTime(m, D + '13:57:00+04:00');
    await shot(m, 's5-08-master-1357');
    log('MASTER now:', await now(m));
    log('MASTER attn:', await attn(m));
    log('MASTER cols:', (await m.locator('main').innerText()).slice(0, 200).replace(/\n+/g, ' | '));
    log('master errors', m.errors);
    await m.context().close();
  });
  // money: client reports payment
  await step('client I paid', async () => {
    const c = await page({ persona: 'client', time: D + '12:20:00+04:00' });
    await c.goto(BASE + '/bookings'); await c.waitForTimeout(4000);
    log('CLIENT bookings:', (await c.locator('main').innerText()).slice(0, 800).replace(/\n+/g, ' | '));
    const paid = c.getByRole('button', { name: 'Я оплатил' });
    log('I paid buttons', await paid.count());
    if (!(await paid.count())) {
      const links = c.locator('main a[href*="/bookings/"]');
      const n = Math.min(await links.count(), 8);
      for (let i = 0; i < n && !(await paid.count()); i++) {
        await links.nth(i).click(); await c.waitForTimeout(2500);
        if (!(await paid.count())) { await c.goBack(); await c.waitForTimeout(2000); }
      }
    }
    if (await paid.count()) {
      await paid.first().click(); await c.waitForTimeout(2000);
      log('client after I paid:', (await c.locator('main').innerText()).slice(0, 300).replace(/\n+/g, ' | '));
      await c.goto(BASE + '/biz/journal?demo=owner'); await c.waitForTimeout(5000);
      await shot(c, 's5-09-owner-reported');
      log('OWNER attn reported:', (await attn(c)).slice(0, 600));
      const mr = c.getByRole('button', { name: 'Деньги пришли' });
      if (await mr.count()) { await mr.first().click(); await c.waitForTimeout(2000); log('TOAST money:', await toast(c)); log('attn after money:', (await attn(c)).slice(0, 300)); }
    }
    log('client errors', c.errors);
    await c.context().close();
  });
  // phone
  await step('phone', async () => {
    const q = await page({ device: 'phone', time: D + '12:20:00+04:00' });
    await setTime(q, D + '13:57:00+04:00');
    await shot(q, 's5-10-phone-1357');
    await q.getByRole('button', { name: /опаздывает/ }).first().click();
    await q.waitForTimeout(1500);
    await shot(q, 's5-11-phone-attn-sheet');
    log('PHONE SHEET:', (await dlg(q)).slice(0, 700));
    log('phone errors', q.errors);
  });
} finally { await stop(); }
