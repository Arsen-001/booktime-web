import { start, stop, page, shot } from './lib.mjs';
const log = (...a) => console.log(...a);
const txt = async (loc) => (await loc.count()) ? (await loc.first().innerText()).replace(/\n+/g, ' | ') : 'NONE';
const toasts = async (p) => txt(p.locator('[data-sonner-toaster], [role="status"], [role="alert"], [aria-live]').filter({ hasText: /\S/ }));
async function step(name, fn) { try { await fn(); } catch (e) { log(`!! ${name}: ${e.message.split('\n')[0]}`); } }
await start();
try {
  const p = await page({ time: '2026-09-30T12:20:00+04:00' });
  const ctx = p.context();
  await p.waitForTimeout(2000);
  await shot(p, 's2-01-desktop-1220');
  log('DayNow@12:20:', await txt(p.locator('[aria-label="Что происходит сейчас"]')));
  log('ATTN@12:20:', await txt(p.locator('aside[aria-label="Требует внимания"]')));
  // advance 20 min
  await ctx.clock.fastForward('20:00');
  await p.waitForTimeout(2500);
  await shot(p, 's2-02-desktop-1240');
  log('DayNow@12:40:', await txt(p.locator('[aria-label="Что происходит сейчас"]')));
  log('ATTN@12:40:', await txt(p.locator('aside[aria-label="Требует внимания"]')));
  log('TOOLBAR buttons:', (await p.locator('main button:visible').allInnerTexts()).map(s=>s.trim()).filter(Boolean).slice(0,40).join(' ¦ '));
  await step('inProgress popover', async () => {
    const b = p.locator('[aria-label="Что происходит сейчас"] button').filter({ hasText: /ид/ });
    await b.first().click();
    await p.waitForTimeout(800);
    await shot(p, 's2-03-now-inprogress');
    log('POPOVER inProgress:', await txt(p.locator('[role="dialog"]:visible')));
    await p.keyboard.press('Escape');
  });
  await step('soon popover', async () => {
    const b = p.locator('[aria-label="Что происходит сейчас"] button').filter({ hasText: /через/ });
    await b.first().click();
    await p.waitForTimeout(800);
    await shot(p, 's2-04-now-soon');
    log('POPOVER soon:', await txt(p.locator('[role="dialog"]:visible')));
    await p.keyboard.press('Escape');
  });
  await step('late click', async () => {
    const b = p.locator('[aria-label="Что происходит сейчас"] button').filter({ hasText: /опаздыва/ });
    log('late btn count', await b.count());
  });
  await step('findslot', async () => {
    await p.getByRole('button', { name: /Найти окно/ }).first().click();
    await p.waitForTimeout(1000);
    await shot(p, 's2-05-findslot');
    log('FINDSLOT:', await txt(p.locator('[role="dialog"]:visible')));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(500);
  });
  await step('list view', async () => {
    await p.getByRole('radio', { name: /Список/ }).first().click().catch(async () => p.getByRole('tab', { name: /Список/ }).first().click());
    await p.waitForTimeout(1500);
    await shot(p, 's2-06-list');
    log('LIST:', (await p.locator('main').innerText()).slice(0, 2500).replace(/\n+/g, ' | '));
  });
  await step('free today', async () => {
    await p.getByRole('button', { name: /Предложить окна/ }).first().click();
    await p.waitForTimeout(1000);
    await shot(p, 's2-07-freetoday');
    log('FREETODAY:', await txt(p.locator('[role="dialog"]:visible')));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(500);
  });
  await step('confirm tomorrow', async () => {
    await p.getByRole('button', { name: /^Напомнить$/ }).first().click();
    await p.waitForTimeout(1000);
    await shot(p, 's2-08-tomorrow');
    log('TOMORROW:', (await txt(p.locator('[role="dialog"]:visible'))).slice(0, 1500));
    await p.keyboard.press('Escape');
  });
  log('errors', p.errors);
  // phone
  const q = await page({ device: 'phone', time: '2026-09-30T12:20:00+04:00' });
  await q.context().clock.fastForward('20:00');
  await q.waitForTimeout(2500);
  await shot(q, 's2-09-phone-1240');
  log('PHONE:', (await q.locator('body').innerText()).slice(0, 1500).replace(/\n+/g, ' | '));
  log('phone errors', q.errors);
} finally { await stop(); }
