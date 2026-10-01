import { start, stop, page, shot, txt, step, BASE } from './lib.mjs';
const log = (...a) => console.log(...a);
const D = '2026-09-30T';
const attn = (p) => txt(p.locator('aside[aria-label="Требует внимания"]'));
const dlg = (p) => txt(p.locator('[role="dialog"]:visible').last());
const toast = async (p) => (await p.locator('[data-toast-viewport]').allInnerTexts()).join(' / ').replace(/\n+/g, ' | ');
const block = (p, name) => p.locator('[data-testid="booking-block"]').filter({ hasText: name }).first();
const closeWin = async (p) => { await p.keyboard.press('Escape'); await p.waitForTimeout(1500); };
const winField = async (p) => (await dlg(p)).match(/\d\d\.\d\d\.\d{4}, [\d:–]+ · [^|]+/)?.[0];
await start();
try {
  const p = await page({ time: D + '12:20:00+04:00' });
  await step('inject prepaid + refund', async () => {
    await p.goto(BASE + '/biz/journal'); await p.waitForTimeout(3000);
    await p.getByRole('button', { name: 'Напомнить', exact: true }).first().click(); await p.waitForTimeout(1500);
    await p.locator('[role="dialog"]:visible').getByRole('button', { name: /Подтвердил/ }).first().click({ force: true });
    await p.waitForTimeout(4000); await closeWin(p);
    await p.waitForTimeout(3000);
    const raw = await p.evaluate(() => localStorage.getItem('bp-mock-db:core:bookings'));
    const list = JSON.parse(raw);
    const nune = list.find((b) => b.start.startsWith('2026-09-30T15:00'));
    const laura = list.find((b) => b.start.startsWith('2026-09-30T16:15'));
    nune.prepayment = { amount: 2000, paid: true };
    laura.status = 'cancelled_by_client'; laura.prepayment = { amount: 1000, paid: true, refundDue: 1000 };
    log('inject', nune.id, laura.id);
    await p.context().addInitScript((json) => {
      if (sessionStorage.getItem('qa-inj')) return;
      sessionStorage.setItem('qa-inj', '1');
      localStorage.setItem('bp-mock-db:core:bookings', json);
    }, JSON.stringify(list));
    await p.goto(BASE + '/biz/journal').catch(() => {}); await p.waitForTimeout(8000);
    await shot(p, 's8-02-refund-attn');
    log('ATTN refund:', (await attn(p)).slice(0, 400));
    const back = p.locator('aside[aria-label="Требует внимания"]').getByRole('button', { name: 'Вернул' });
    log('Вернул buttons', await back.count());
    if (await back.count()) { await back.first().click(); await p.waitForTimeout(2500); log('TOAST refunded:', await toast(p)); log('ATTN after:', (await attn(p)).slice(0, 150)); }
  });
  await step('master cancel prepaid', async () => {
    await block(p, 'Нуне').click(); await p.waitForTimeout(3500);
    const w = await dlg(p);
    log('NUNE window:', await winField(p), '| toPay:', w.match(/К оплате \| [^|]+/)?.[0], '| policy:', w.match(/Предоплата[^]*?(Оплачена|Ждёт|Верните)[^|]*/)?.[0]?.slice(0, 200));
    await p.locator('[role="dialog"]:visible').getByRole('button', { name: 'Отменил мастер' }).first().click().catch(() => p.locator('[role="dialog"]:visible').getByText('Отменил мастер').first().click());
    await p.waitForTimeout(1500);
    log('CONFIRM:', (await txt(p.locator('[role="alertdialog"]:visible'))).slice(0, 300));
    await p.getByRole('button', { name: 'Отменить и вернуть' }).click(); await p.waitForTimeout(800);
    log('TOAST before save (expect none):', await toast(p));
    await p.locator('[role="dialog"]:visible').getByRole('button', { name: /Сохранить/ }).last().click(); await p.waitForTimeout(3500);
    log('TOAST after save:', await toast(p));
    await p.goto(BASE + '/biz/journal'); await p.waitForTimeout(5000);
    await shot(p, 's8-03-after-master-cancel');
    log('ATTN after cancel:', (await attn(p)).slice(0, 400));
    const back = p.locator('aside[aria-label="Требует внимания"]').getByRole('button', { name: 'Вернул' });
    await back.first().click(); await p.waitForTimeout(2500);
    log('TOAST refunded:', await toast(p));
    log('ATTN after refunded:', (await attn(p)).slice(0, 200));
    await block(p, 'Нуне').click().catch(() => {}); await p.waitForTimeout(3000);
    log('window policy after refunded:', (await dlg(p)).match(/Предоплата[^]*?(Возвращена|Верните)[^|]*/)?.[0]?.slice(0, 200));
  });
  log('errors', p.errors.filter((e) => !/Hydration|i18n/.test(e)));
} finally { await stop(); }
