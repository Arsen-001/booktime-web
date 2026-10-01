import { start, stop, open, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/online/settings`, { device: 'desktop' });
const S = page.getByRole('switch'); const st = async () => (await S.evaluateAll(els=>els.map(e=>e.getAttribute('aria-checked')==='true'?1:0))).join('');
await S.nth(4).click(); await S.nth(5).click(); await page.waitForTimeout(300); await S.nth(6).click(); await page.waitForTimeout(300);
console.log('after toggles', await st());
await page.getByPlaceholder('Название поля').fill('Номер машины');
await page.getByRole('button', { name: 'Добавить поле' }).click(); await page.waitForTimeout(1500);
console.log('after add field (no reload)', await st(), await toasts(page));
// navigate away via menu link to check unsaved guard
await S.nth(4).click(); await page.waitForTimeout(200); console.log('toggled again', await st());
await page.getByRole('link', { name: 'Заявки' }).first().click(); await page.waitForTimeout(1500);
console.log('after nav click url', page.url(), 'dialog', await page.locator('[role=alertdialog]').count());
await as(page, 'owner', '/biz/online/settings');
await S.nth(4).click(); await S.nth(5).click(); await page.waitForTimeout(300); await S.nth(6).click(); await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Сохранить' }).nth(1).click(); await page.waitForTimeout(1500); console.log('save toasts', await toasts(page));
await reload(page); console.log('after save+reload', await st());
await stop();
