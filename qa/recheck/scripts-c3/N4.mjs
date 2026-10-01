import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/notifications/log');
const T = async (n=1200) => (await text(page)).slice(0, n);
const rows0 = (await page.locator('main tbody tr').allInnerTexts()).filter(r => /пароль|Пароль/.test(r)).map(r => r.replace(/\s+/g, ' ').slice(0, 140)); console.log('password rows before:', rows0);
// first login with password change
await as(page, 'guest', '/login');
await page.getByRole('radio', { name: 'Мастер или бизнес' }).click(); await page.getByText('Логин и пароль', { exact: true }).click(); await page.waitForTimeout(300);
const ins = page.locator('main input:visible'); await ins.nth(0).fill('lilit'); await ins.nth(1).fill('lilit'); await page.getByRole('button', { name: /^Войти$/ }).click(); await page.waitForTimeout(1500);
const dlg = page.locator('[role=dialog]').last(); await dlg.locator('input').first().fill('Secret777'); await dlg.getByRole('button').last().click(); await page.waitForTimeout(2500);
console.log('toasts', await toasts(page), page.url());
await as(page, 'owner', '/biz/notifications/log');
const rows1 = (await page.locator('main tbody tr').allInnerTexts()).filter(r => /пароль|Пароль/.test(r)).map(r => r.replace(/\s+/g, ' ').slice(0, 140)); console.log('password rows after:', rows1);
// per-booking reminder override in booking window notify tab
await go(page, '/biz/journal?booking=bk_1605');
const w = page.locator('[role=dialog]').last(); await w.getByRole('tab', { name: 'Уведомления' }).click(); await page.waitForTimeout(800);
console.log('notify tab:', (await w.innerText()).split('\n').filter(Boolean).slice(8, 30).join(' | '));
await shot(page, 'N4-window-notify');
await stop();
