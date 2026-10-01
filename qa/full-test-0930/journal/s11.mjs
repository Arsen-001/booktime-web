import { start, stop, page, shot, txt, step, BASE } from './lib.mjs';
const log = (...a) => console.log(...a);
const D = '2026-09-30T';
const attn = (p) => txt(p.locator('aside[aria-label="Требует внимания"]'));
const dlg = (p) => txt(p.locator('[role="dialog"]:visible').last());
const block = (p, name) => p.locator('[data-testid="booking-block"]').filter({ hasText: name }).first();
await start();
try {
  const p = await page({ time: D + '12:20:00+04:00' });
  await step('inject + to pay', async () => {
    await p.getByRole('button', { name: 'Напомнить', exact: true }).first().click(); await p.waitForTimeout(1500);
    await p.locator('[role="dialog"]:visible').getByRole('button', { name: /Подтвердил/ }).first().click({ force: true });
    await p.waitForTimeout(4000); await p.keyboard.press('Escape'); await p.waitForTimeout(3000);
    const list = JSON.parse(await p.evaluate(() => localStorage.getItem('bp-mock-db:core:bookings')));
    const nune = list.find((b) => b.start.startsWith('2026-09-30T15:00'));
    nune.prepayment = { amount: 2000, paid: true };
    await p.context().addInitScript((json) => { if (sessionStorage.getItem('qa-inj')) return; sessionStorage.setItem('qa-inj', '1'); localStorage.setItem('bp-mock-db:core:bookings', json); }, JSON.stringify(list));
    await p.goto(BASE + '/biz/journal').catch(() => {}); await p.waitForTimeout(8000);
    await block(p, 'Нуне').click(); await p.waitForTimeout(4000);
    const w = await dlg(p);
    log('toPay:', w.match(/К оплате \| [^|]+ \| [^|]+ \| [^|]+/)?.[0], '| qty aria:', await p.locator('[role="dialog"]:visible button[aria-label*="оличество"]').count());
    await shot(p, 's11-01-prepaid-window');
    await p.keyboard.press('Escape'); await p.waitForTimeout(1500);
  });
  await step('records labels', async () => {
    await p.goto(BASE + '/biz/records'); await p.waitForTimeout(6000);
    const m = await p.locator('main').innerText();
    log('records has Удалённые:', /Удалённые/.test(m), 'Кроме удалённых:', /Кроме удалённых/.test(m), 'old Отменённые:', /\nОтменённые/.test(m));
  });
  log('errors', p.errors.filter((e) => !/Hydration/.test(e)).slice(0, 5));
} finally { await stop(); }
