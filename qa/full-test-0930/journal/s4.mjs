import { start, stop, page, shot, setTime, txt, step, BASE } from './lib.mjs';
const log = (...a) => console.log(...a);
const D = '2026-09-30T';
const now = (p) => txt(p.locator('[aria-label="Что происходит сейчас"]'));
const attn = (p) => txt(p.locator('aside[aria-label="Требует внимания"]'));
const dlg = (p) => txt(p.locator('[role="dialog"]:visible').last());
const toast = async (p) => (await p.locator('[data-toast-viewport]').allInnerTexts()).join(' / ').replace(/\n+/g, ' | ');
await start();
try {
  const p = await page({ time: D + '12:20:00+04:00' });
  await setTime(p, D + '13:57:00+04:00');
  log('13:57 now:', await now(p));
  await step('shift +15', async () => {
    await p.getByRole('button', { name: /Ещё действия:/ }).first().click();
    await p.waitForTimeout(600);
    await p.getByRole('menuitem', { name: /Сдвинуть на 15/ }).click();
    await p.waitForTimeout(1200);
    log('TOAST shift:', await toast(p));
    await shot(p, 's4-01-shift');
  });
  await step('arrive late', async () => {
    await p.getByRole('button', { name: /^Пришёл: / }).first().click();
    await p.waitForTimeout(1500);
    log('TOAST arrive:', await toast(p));
    log('now after arrive:', await now(p));
    log('attn after arrive:', (await attn(p)).slice(0, 250));
  });
  await step('finish early', async () => {
    await p.waitForTimeout(31000);
    log('now tick:', await now(p));
    await p.locator('[aria-label="Что происходит сейчас"] button').filter({ hasText: /ид/ }).first().click();
    await p.waitForTimeout(800);
    log('INPROG POP:', await dlg(p));
    await p.getByRole('button', { name: 'Закончили раньше' }).first().click();
    await p.waitForTimeout(1500);
    log('TOAST finish:', await toast(p));
    await shot(p, 's4-02-finish-toast');
    const offer = p.locator('[data-toast-viewport]').getByRole('button', { name: 'Предложить окно' });
    if (await offer.count()) { await offer.first().click(); await p.waitForTimeout(1500); log('OFFER SHEET:', (await dlg(p)).slice(0, 600)); await p.keyboard.press('Escape'); await p.waitForTimeout(800); }
  });
  await step('next visit from window', async () => {
    await p.locator('[data-testid="booking-block"]').filter({ hasText: 'Сирануш' }).first().click();
    await p.waitForTimeout(2500);
    log('URL', p.url());
    const w = await dlg(p);
    log('WINDOW Сирануш:', w.slice(0, 900));
    await shot(p, 's4-03-window-arrived');
    await p.getByRole('button', { name: 'Записать на следующий визит' }).click();
    await p.waitForTimeout(3500);
    log('URL next', p.url());
    log('NEXT WINDOW:', (await dlg(p)).slice(0, 900));
    log('TOAST next:', await toast(p));
    await shot(p, 's4-04-next-visit');
    await p.goto(BASE + '/biz/journal'); await p.waitForTimeout(2500);
  });
  await step('list view', async () => {
    await p.getByText('Список', { exact: true }).first().click();
    await p.waitForTimeout(2000);
    await shot(p, 's4-05-list');
    log('LIST:', (await p.locator('main').innerText()).slice(0, 1800).replace(/\n+/g, ' | '));
    const pay = p.locator('[data-list-action="pay"]');
    log('pay buttons', await pay.count(), 'arrive buttons', await p.locator('[data-list-action="arrive"]').count());
    if (await pay.count()) { await pay.first().click(); await p.waitForTimeout(1500); log('TOAST pay:', await toast(p)); await shot(p, 's4-06-list-paid'); }
    const all = p.getByText(/^Все · /).first();
    if (await all.count()) { await all.click(); await p.waitForTimeout(1000); log('LIST ALL head:', (await p.locator('main').innerText()).slice(0, 600).replace(/\n+/g, ' | ')); }
    await p.getByText('Колонки', { exact: true }).first().click(); await p.waitForTimeout(1000);
  });
  await step('confirm tomorrow', async () => {
    await p.getByRole('button', { name: 'Напомнить', exact: true }).first().click();
    await p.waitForTimeout(1500);
    const c = p.locator('[role="dialog"]:visible').getByRole('button', { name: /Подтвердил/ });
    const n0 = await c.count();
    await c.first().click({ timeout: 8000 }).catch(async (e) => { log('click fail, force', e.message.split('\n')[0]); await c.first().click({ force: true }); });
    await p.waitForTimeout(1500);
    log('confirm', n0, '->', await c.count(), 'TOAST:', await toast(p));
    log('subtitle:', (await dlg(p)).slice(0, 120));
    await p.keyboard.press('Escape'); await p.waitForTimeout(800);
    log('attn tomorrow:', (await attn(p)).match(/Завтра[^|]*/)?.[0]);
  });
  await step('search', async () => {
    await p.getByRole('button', { name: 'Найти клиента' }).first().click().catch(() => p.locator('button:has(svg.lucide-search)').first().click());
    await p.waitForTimeout(1000);
    await p.keyboard.type('Сирануш');
    await p.waitForTimeout(2000);
    await shot(p, 's4-07-search');
    log('SEARCH:', (await dlg(p)).slice(0, 900));
    await p.keyboard.press('Escape'); await p.waitForTimeout(600);
  });
  log('errors', p.errors);
  // requests with prepayment
  await step('requests', async () => {
    await p.goto(BASE + '/biz/online/requests'); await p.waitForTimeout(4000);
    const body = (await p.locator('main').innerText()).replace(/\n+/g, ' | ');
    log('REQUESTS:', body.slice(0, 1500));
    log('money buttons', await p.getByRole('button', { name: 'Деньги пришли' }).count());
  });
  // phone
  const q = await page({ device: 'phone', time: D + '12:20:00+04:00' });
  await setTime(q, D + '13:57:00+04:00');
  await shot(q, 's4-08-phone-1357');
  log('PHONE top:', (await q.locator('main').innerText()).slice(0, 400).replace(/\n+/g, ' | '));
  await step('phone late bar', async () => {
    await q.getByRole('button', { name: /опаздывает/ }).first().click();
    await q.waitForTimeout(1500);
    await shot(q, 's4-09-phone-attn-sheet');
    log('PHONE SHEET:', (await dlg(q)).slice(0, 900));
  });
  log('phone errors', q.errors);
} finally { await stop(); }
