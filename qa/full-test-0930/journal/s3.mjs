import { start, stop, page, shot, setTime, txt, step } from './lib.mjs';
const log = (...a) => console.log(...a);
const D = '2026-09-30T';
const now = (p) => txt(p.locator('[aria-label="Что происходит сейчас"]'));
const attn = (p) => txt(p.locator('aside[aria-label="Требует внимания"]'));
const dlg = (p) => txt(p.locator('[role="dialog"]:visible').last());
const toast = async (p) => (await p.locator('section[aria-label*="otif"], [data-sonner-toast], [role="status"]').allInnerTexts()).join(' / ').replace(/\n+/g,' | ');
await start();
try {
  const p = await page({ time: D + '12:20:00+04:00' });
  log('A 12:20 now:', await now(p));
  log('A 12:20 attn:', await attn(p));
  await step('open pending', async () => {
    await p.locator('aside[aria-label="Требует внимания"] li button').first().click();
    await p.waitForTimeout(2500);
    await shot(p, 's3-01-pending-window');
    log('PENDING WINDOW:', (await dlg(p)).slice(0, 1800));
    log('URL', p.url());
    await p.keyboard.press('Escape'); await p.waitForTimeout(1500);
  });
  await setTime(p, D + '12:25:00+04:00');
  log('A 12:25 attn:', await attn(p));
  await setTime(p, D + '13:57:00+04:00');
  await shot(p, 's3-02-1357');
  log('A 13:57 now:', await now(p));
  log('A 13:57 attn:', await attn(p));
  await step('late click in DayNow', async () => {
    const b = p.locator('[aria-label="Что происходит сейчас"] button').filter({ hasText: /опаздыва/ });
    log('late btn', await b.count());
  });
  await step('overrun warn', async () => {
    await p.getByRole('button', { name: 'Предупредить следующего' }).first().click();
    await p.waitForTimeout(800);
    await shot(p, 's3-03-overrun-menu');
    log('MENU:', await txt(p.locator('[role="menu"]:visible')));
    await p.getByRole('menuitem', { name: /Задержка 15/ }).click();
    await p.waitForTimeout(1500);
    log('TOAST after warn:', await toast(p));
    log('attn after warn:', await attn(p));
  });
  await step('late shift +15', async () => {
    await p.getByRole('button', { name: /Ещё действия:/ }).first().click();
    await p.waitForTimeout(800);
    log('LATE MENU:', await txt(p.locator('[role="menu"]:visible')));
    await shot(p, 's3-04-late-menu');
    await p.getByRole('menuitem', { name: /Сдвинуть на 15/ }).click();
    await p.waitForTimeout(2000);
    log('TOAST after shift:', await toast(p));
    await shot(p, 's3-05-after-shift');
    log('attn after shift:', await attn(p));
  });
  await setTime(p, D + '14:20:00+04:00');
  await shot(p, 's3-06-1420');
  log('A 14:20 now:', await now(p));
  log('A 14:20 attn:', await attn(p));
  await step('soon popover + start now', async () => {
    await p.locator('[aria-label="Что происходит сейчас"] button').filter({ hasText: /через/ }).first().click();
    await p.waitForTimeout(800);
    log('SOON POP:', await dlg(p));
    await shot(p, 's3-07-soon-pop');
    const btns = p.getByRole('button', { name: 'Начать сейчас' });
    log('start-now buttons', await btns.count());
    if (await btns.count()) { await btns.first().click(); await p.waitForTimeout(2000); log('TOAST start now:', await toast(p)); await shot(p, 's3-08-after-startnow'); }
    await p.keyboard.press('Escape'); await p.waitForTimeout(500);
    log('popover still open after Esc?', await p.locator('[role="dialog"]:visible').count());
  });
  await step('inprogress finish early', async () => {
    await p.locator('[aria-label="Что происходит сейчас"] button').filter({ hasText: /ид/ }).first().click();
    await p.waitForTimeout(800);
    log('INPROG POP:', await dlg(p));
    const b = p.getByRole('button', { name: 'Закончили раньше' });
    if (await b.count()) {
      await b.first().click(); await p.waitForTimeout(2000);
      log('TOAST finish:', await toast(p)); await shot(p, 's3-09-after-finish');
      const offer = p.getByRole('button', { name: 'Предложить окно' });
      if (await offer.count()) { await offer.first().click(); await p.waitForTimeout(1500); log('OFFER SHEET:', (await dlg(p)).slice(0, 1200)); await shot(p, 's3-10-offer-sheet'); await p.keyboard.press('Escape'); await p.waitForTimeout(800); }
    }
  });
  await step('free today sheet', async () => {
    await p.getByRole('button', { name: 'Предложить окна' }).first().click();
    await p.waitForTimeout(1500);
    log('FREETODAY:', (await dlg(p)).slice(0, 1500));
    await shot(p, 's3-11-freetoday');
    const send = p.getByRole('button', { name: /Отправить/ });
    log('send btn:', await send.count() ? await send.first().innerText() : 'none');
    if (await send.count() && await send.first().isEnabled()) { await send.first().click(); await p.waitForTimeout(1500); log('TOAST sent:', await toast(p)); }
    await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  });
  await step('confirm tomorrow', async () => {
    await p.getByRole('button', { name: 'Напомнить', exact: true }).first().click();
    await p.waitForTimeout(1500);
    log('TOMORROW:', (await dlg(p)).slice(0, 1200));
    await shot(p, 's3-12-tomorrow');
    const c = p.getByRole('button', { name: 'Подтвердил' });
    const n0 = await c.count();
    await c.first().click(); await p.waitForTimeout(1500);
    log('confirm count', n0, '->', await p.getByRole('button', { name: 'Подтвердил' }).count(), 'TOAST:', await toast(p));
    log('subtitle now:', (await dlg(p)).slice(0, 200));
    await p.keyboard.press('Escape'); await p.waitForTimeout(800);
    log('attn tomorrow after:', (await attn(p)).slice(0, 200));
  });
  await step('find slot', async () => {
    await p.getByRole('button', { name: /Найти окно/ }).first().click();
    await p.waitForTimeout(1200);
    await shot(p, 's3-13-findslot');
    log('FINDSLOT:', (await dlg(p)).slice(0, 800));
    const opt = p.locator('[role="dialog"]:visible [role="option"], [role="dialog"]:visible li button').first();
    await opt.click(); await p.waitForTimeout(1500);
    await shot(p, 's3-14-findslot-picked');
    log('FINDSLOT picked:', (await dlg(p)).slice(0, 1500));
  });
  log('errors A', p.errors);
} finally { await stop(); }
