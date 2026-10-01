import { start, stop, open, reload } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/notifications/inbox`, { device: 'desktop' });
const dots = () => page.locator('main span.bg-danger.rounded-full').count();
console.log('dots before', await dots());
await page.getByRole('button', { name: 'Прочитать все' }).click(); await page.waitForTimeout(1500);
console.log('dots after', await dots()); await reload(page); console.log('dots after reload', await dots());
await stop();
