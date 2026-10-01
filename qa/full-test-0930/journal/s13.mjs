import { start, stop, page, shot, txt, step, BASE } from './lib.mjs';
const log = (...a) => console.log(...a);
const dlg = (p) => p.locator('[role="dialog"]:visible').last();
const toast = async (p) => (await p.locator('[data-toast-viewport]').allInnerTexts()).join(' / ').replace(/\n+/g, ' | ');
const block = (p, name) => p.locator('[data-testid="booking-block"]').filter({ hasText: name }).first();
const chip = (p, name) => dlg(p).getByRole('radio', { name, exact: true }).or(dlg(p).getByRole('button', { name, exact: true })).first();
const save = (p) => dlg(p).getByRole('button', { name: /Сохранить изменения/ });
await start();
try {
  const p = await page({ time: '2026-09-30T12:20:00+04:00' });
  await step('A: unsaved Не пришёл -> Пришёл', async () => {
    await block(p, 'Нуне').click(); await p.waitForTimeout(4000);
    log('A save enabled at open:', await save(p).isEnabled());
    await chip(p, 'Не пришёл').click(); await p.waitForTimeout(1500);
    log('A after Не пришёл save enabled:', await save(p).isEnabled(), 'alert:', await txt(p.locator('[role="alertdialog"]:visible')));
    await chip(p, 'Пришёл').click(); await p.waitForTimeout(1500);
    log('A after Пришёл save enabled:', await save(p).isEnabled(), 'toast:', await toast(p));
    await shot(p, 's13-a');
    await save(p).click(); await p.waitForTimeout(3000);
    log('A after save toast:', await toast(p));
  });
  await step('B: saved no_show -> Пришёл', async () => {
    await p.goto(BASE + '/biz/journal').catch(() => {}); await p.waitForTimeout(5000);
    await block(p, 'Шушан').click(); await p.waitForTimeout(4000);
    await chip(p, 'Не пришёл').click(); await p.waitForTimeout(1000);
    await save(p).click(); await p.waitForTimeout(3000);
    log('B saved no_show toast:', await toast(p));
    await p.goto(BASE + '/biz/journal').catch(() => {}); await p.waitForTimeout(5000);
    await p.locator('[data-testid="booking-block"]').filter({ hasText: 'Шушан' }).first().click(); await p.waitForTimeout(4000);
    await chip(p, 'Пришёл').click(); await p.waitForTimeout(2000);
    log('B after Пришёл save enabled:', await save(p).isEnabled(), 'toast:', await toast(p));
    await shot(p, 's13-b');
  });
  log('errors', p.errors.filter((e) => !/Hydration|i18n/.test(e)).slice(0, 5));
} finally { await stop(); }
