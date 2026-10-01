import { start, stop, open, shot } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/notifications/inbox`, { device: 'desktop' });
await shot(page, 'n7-inbox-before');
const html = await page.locator('main li, main [role=listitem], main a, main button').filter({ hasText: 'Новая запись' }).first().evaluate(e=>e.outerHTML.slice(0,700)); console.log(html);
await page.getByRole('button', { name: 'Прочитать все' }).click(); await page.waitForTimeout(1500);
const html2 = await page.locator('main li, main [role=listitem], main a, main button').filter({ hasText: 'Новая запись' }).first().evaluate(e=>e.outerHTML.slice(0,700)); console.log('AFTER', html2);
await shot(page, 'n7-inbox-after');
await stop();
