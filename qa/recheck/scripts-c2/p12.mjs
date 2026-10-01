import { start, stop, open, shot } from './lib.mjs';
await start();
const { page } = await open('platform', '/platform/businesses', { device: 'desktop' });
await page.getByText('Nuri Nail Studio').first().click(); await page.waitForTimeout(2000);
console.log(page.url(), (await page.locator('body').innerText()).slice(0,1200).replace(/\n/g,' | '));
console.log(await page.getByRole('tab').allInnerTexts());
await shot(page, 'p12-biz-card');
await stop();
