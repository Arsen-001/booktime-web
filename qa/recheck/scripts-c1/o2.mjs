import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
await start();
const { page } = await open('guest', '/b/nuri-nail-studio/book', { device: 'phone' });
log('--- step1\n' + (await text(page)).slice(0, 1200));
await page.getByText('Маникюр классический', { exact: true }).first().click(); await page.waitForTimeout(500);
await page.getByRole('button', { name: /Продолжить/ }).click(); await page.waitForTimeout(1500);
log('--- step2\n' + (await text(page)).slice(0, 1200));
await page.getByText('Ани Саргсян').first().click(); await page.waitForTimeout(1200);
log('--- modal?\n' + (await page.locator('[role=dialog]').allInnerTexts()).join('\n---\n').slice(0,1500));
await shot(page, 'o2-modal');
await stop(); process.exit(0);
const cont = page.getByRole('button', { name: /Продолжить/ }); if (await cont.count() && await cont.isEnabled()) { await cont.click(); }
await page.waitForTimeout(1500);
log('--- step3\n' + (await text(page)).slice(0, 2000));
await shot(page, 'o2-step3', true);
log('ERR', page.errors.slice(0,3));
await stop();
