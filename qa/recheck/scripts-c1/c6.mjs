import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
await start();
const { page } = await open('client', '/bookings', { device: 'phone' });
await page.getByRole('tab', { name: /Прошедшие/ }).click(); await page.waitForTimeout(800);
await page.getByText('Женская стрижка').click(); await settle(page);
log('URL', page.url()); log(await text(page, 'body'));
await shot(page, 'c6-past-detail');
const rep = page.getByText(/Повторить запись/);
log('repeat', await rep.count());
if (await rep.count()) { log('href', await page.locator('a', { hasText: 'Повторить запись' }).first().getAttribute('href').catch(()=>null)); await rep.first().click(); await settle(page); log('URL', page.url()); log((await text(page)).slice(0,1200)); }
await go(page, '/bookings/bk_0080'); log('--- 0080 direct\n' + await text(page, 'body'));
log('ERR', page.errors);
await stop();
