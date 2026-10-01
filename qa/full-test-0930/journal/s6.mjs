import { start, stop, page, shot, setTime, txt, step, BASE } from './lib.mjs';
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
  log('pending hint:', (await attn(p)).match(/(Ответьте|Срок)[^|]*/)?.[0]);
  await setTime(p, D + '13:57:00+04:00', 3000);
  await step('next visit from open window', async () => {
    await p.getByRole('button', { name: /^Пришёл: / }).first().click();
    await p.waitForTimeout(1500);
    await block(p, 'Сирануш').click();
    await p.waitForTimeout(3000);
    log('WIN1:', await winField(p));
    await p.getByRole('button', { name: 'Записать на следующий визит' }).click();
    for (let i = 0; i < 20 && !/new=1/.test(p.url()); i++) await p.waitForTimeout(1000);
    await p.waitForTimeout(3500);
    log('URL next', p.url());
    const w = await dlg(p);
    log('NEXT WINDOW:', await winField(p), '| status chips:', w.match(/Статус визита[^]*?Отменил мастер/)?.[0]?.slice(0, 40), '| services:', w.match(/Педикюр[^|]*\| [\d ]+֏/)?.[0], '| toPay:', w.match(/К оплате \| [^|]+/)?.[0]);
    await shot(p, 's6-01-next-visit');
    await closeWin(p);
  });
  await step('duplicate', async () => {
    await p.goto(BASE + '/biz/journal'); await p.waitForTimeout(3000);
    await block(p, 'Нуне').click(); await p.waitForTimeout(3000);
    log('DUP src:', await winField(p));
    await p.getByRole('button', { name: 'Дублировать' }).click();
    for (let i = 0; i < 15 && !/new=1/.test(p.url()); i++) await p.waitForTimeout(1000);
    await p.waitForTimeout(3500);
    log('URL dup', p.url(), 'TOAST', await toast(p));
    log('DUP window:', await winField(p));
    await shot(p, 's6-02-duplicate');
    await closeWin(p);
  });
  await step('split + qty labels', async () => {
    await p.goto(BASE + '/biz/journal'); await p.waitForTimeout(3000);
    await block(p, 'Шушан').click(); await p.waitForTimeout(3000);
    log('qty labels:', await p.locator('[role="dialog"]:visible button[aria-label*="количество"]').count());
    await p.locator('[role="dialog"]:visible').getByRole('button', { name: 'Оплатить', exact: true }).first().click();
    await p.waitForTimeout(2000);
    const split = p.getByRole('tab', { name: /Раздельн|По частям|Раздел/ });
    if (await split.count()) await split.first().click(); else await p.getByText(/Раздельн/).first().click();
    await p.waitForTimeout(800);
    log('split hint before:', (await dlg(p)).match(/Осталось оплатить: [^|]+/)?.[0]);
    await p.locator('[role="dialog"]:visible input[inputmode="decimal"]').first().fill('500');
    await p.waitForTimeout(500);
    log('split hint after 500:', (await dlg(p)).match(/Осталось оплатить: [^|]+/)?.[0]);
    await shot(p, 's6-03-split');
    await closeWin(p); await closeWin(p);
  });
  await step('records labels', async () => {
    await p.goto(BASE + '/biz/records'); await p.waitForTimeout(4000);
    log('RECORDS filters:', (await p.locator('main').innerText()).match(/Все\s+[^\n]*\n?[^\n]*удал[^\n]*/i)?.[0]?.replace(/\n/g, ' | '));
  });
  log('errors owner', p.errors.filter((e) => !/Hydration/.test(e)).slice(0, 8));
  // money
  await step('client I paid -> owner money received -> master cancel -> refund', async () => {
    const c = await page({ persona: 'client', time: D + '12:20:00+04:00' });
    await c.goto(BASE + '/bookings'); await c.waitForTimeout(5000);
    log('CLIENT bookings:', (await c.locator('main').innerText()).slice(0, 600).replace(/\n+/g, ' | '));
    const paid = c.getByRole('button', { name: 'Я оплатил' });
    if (!(await paid.count())) {
      const links = c.locator('main a[href*="/bookings/"]');
      const n = Math.min(await links.count(), 10);
      for (let i = 0; i < n && !(await paid.count()); i++) {
        const href = await links.nth(i).getAttribute('href');
        await c.goto(BASE + href); await c.waitForTimeout(3000);
      }
    }
    log('I paid buttons', await paid.count(), c.url());
    if (!(await paid.count())) return;
    await paid.first().click(); await c.waitForTimeout(2500);
    await c.goto(BASE + '/biz/journal?demo=owner'); await c.waitForTimeout(6000);
    await shot(c, 's6-04-owner-reported');
    log('OWNER attn:', (await attn(c)).slice(0, 500));
    const mr = c.getByRole('button', { name: 'Деньги пришли' });
    if (!(await mr.count())) return;
    const rowText = (await c.locator('aside[aria-label="Требует внимания"] li').filter({ has: mr }).first().innerText()).replace(/\n+/g, ' | ');
    log('reported row:', rowText);
    await mr.first().click(); await c.waitForTimeout(2500);
    log('TOAST money:', await toast(c));
    log('attn after money:', (await attn(c)).slice(0, 200));
    // open that booking via search by client name
    const name = rowText.split('|')[0].replace(/^[^А-ЯA-Z]*/, '').split('·')[0].trim().split(' ').slice(-2)[0];
    log('client name guess', name);
    await c.getByRole('button', { name: 'Найти клиента' }).first().click(); await c.waitForTimeout(800);
    await c.keyboard.type(name); await c.waitForTimeout(2500);
    const rec = c.locator('[role="dialog"]:visible').getByText('Записан').first();
    await rec.click(); await c.waitForTimeout(4000);
    const w = await dlg(c);
    log('PREPAID WINDOW:', await winField(c), '| toPay:', w.match(/К оплате \| [^|]+ \| [^|]+/)?.[0], '| policy:', w.match(/Предоплата[^|]*\| [^|]+ \| [^|]+ \| [^|]+/)?.[0]);
    await shot(c, 's6-05-prepaid-window');
    await c.locator('[role="dialog"]:visible').getByRole('radio', { name: 'Отменил мастер' }).first().click().catch(() => c.locator('[role="dialog"]:visible').getByRole('button', { name: 'Отменил мастер' }).first().click());
    await c.waitForTimeout(1200);
    log('CONFIRM dialog:', (await txt(c.locator('[role="alertdialog"]:visible, [role="dialog"]:visible').last())).slice(0, 300));
    await c.getByRole('button', { name: 'Отменить и вернуть' }).click(); await c.waitForTimeout(800);
    await c.getByRole('button', { name: /Сохранить/ }).last().click(); await c.waitForTimeout(3000);
    log('TOAST cancel:', await toast(c));
    await c.goto(BASE + '/biz/journal'); await c.waitForTimeout(5000);
    await shot(c, 's6-06-refund-attn');
    log('attn refund:', (await attn(c)).slice(0, 400));
    const back = c.getByRole('button', { name: 'Вернул' });
    if (await back.count()) { await back.first().click(); await c.waitForTimeout(2000); log('TOAST refunded:', await toast(c)); log('attn after refund:', (await attn(c)).slice(0, 200)); }
    log('client ctx errors', c.errors.filter((e) => !/Hydration/.test(e)).slice(0, 8));
  });
} finally { await stop(); }
