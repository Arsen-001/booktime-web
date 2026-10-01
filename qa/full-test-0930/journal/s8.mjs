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
  await step('next visit from open window', async () => {
    await block(p, 'Мане').click(); await p.waitForTimeout(3000);
    log('WIN1:', await winField(p));
    await p.getByRole('button', { name: 'Записать на следующий визит' }).click();
    for (let i = 0; i < 25 && !/new=1/.test(p.url()); i++) await p.waitForTimeout(1000);
    await p.waitForTimeout(4000);
    log('URL next', p.url());
    const w = await dlg(p);
    log('NEXT WINDOW head:', w.slice(0, 500));
    await shot(p, 's8-01-next-visit');
    await closeWin(p);
    log('errors after next', p.errors.filter((e) => !/Hydration|i18n/.test(e)));
  });
  await step('inject prepaid + refund', async () => {
    await p.goto(BASE + '/biz/journal'); await p.waitForTimeout(3000);
    await p.getByRole('button', { name: 'Напомнить', exact: true }).first().click(); await p.waitForTimeout(1500);
    await p.locator('[role="dialog"]:visible').getByRole('button', { name: /Подтвердил/ }).first().click({ force: true });
    await p.waitForTimeout(4000); await closeWin(p);
    const r = await p.evaluate(() => {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('bp-mock-db'));
      const k = keys.find((x) => /core.*bookings/.test(x));
      if (!k) return 'no key: ' + keys.join(',');
      const list = JSON.parse(localStorage.getItem(k));
      const arr = Array.isArray(list) ? list : list.state ?? list;
      const nune = arr.find((b) => b.start.startsWith('2026-09-30T15:00'));
      const laura = arr.find((b) => b.start.startsWith('2026-09-30T16:15'));
      if (!nune || !laura) return 'not found';
      nune.prepayment = { amount: 2000, paid: true };
      laura.status = 'cancelled_by_client'; laura.prepayment = { amount: 1000, paid: true, refundDue: 1000 };
      localStorage.setItem(k, JSON.stringify(list));
      return 'ok ' + k + ' ' + nune.id + ' ' + laura.id;
    });
    log('inject:', r);
    await p.reload(); await p.waitForTimeout(6000);
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
  });
  log('errors', p.errors.filter((e) => !/Hydration|i18n/.test(e)));
} finally { await stop(); }
