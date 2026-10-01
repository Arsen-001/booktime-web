import { start, stop, open, go, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/online/settings');
const T = async (n=1200) => (await text(page, 'body')).slice(0, n);
await page.locator('main').getByRole('switch').first().click(); await page.waitForTimeout(1200); console.log(await toasts(page));
const d = await db(page); console.log('online keys', Object.keys(d.areas.online)); const p = Object.entries(d.areas.online).filter(([k]) => /pause/i.test(k)); console.log(JSON.stringify(p).slice(0, 300));
await as(page, 'guest', '/b/nuri-nail-studio/book');
await page.getByRole('button', { name: 'Индивидуальная запись' }).click(); await page.waitForTimeout(1200);
console.log('widget step:', (await T(700)).replace(/\n/g, ' | '));
await page.getByText('Педикюр классический', { exact: true }).first().click(); await page.waitForTimeout(400);
await page.getByRole('button', { name: /Продолжить/ }).first().click(); await page.waitForTimeout(1000);
await page.getByText('Мариам Петросян').first().click(); await page.waitForTimeout(400);
await page.getByRole('button', { name: /Продолжить/ }).first().click(); await page.waitForTimeout(1000);
const near = page.getByRole('button', { name: 'Перейти к ближайшей дате' }); if (await near.count()) { await near.click(); await page.waitForTimeout(900); }
console.log('times:', (await page.locator('button').filter({ hasText: /^\d{1,2}:\d{2}$/ }).allInnerTexts()).join(' '), '|', (await T(1500)).split('\n').filter(l => /приостан|пауз|недоступ|закрыт/i.test(l)).slice(0, 3));
await shot(page, 'O9-paused-widget');
await as(page, 'guest', '/b/nuri-nail-studio'); console.log('public page:', (await T(3000)).split('\n').filter(l => /приостан|пауз|недоступ|закрыт|Записаться/i.test(l)).slice(0, 4));
await stop();
