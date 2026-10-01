import { start, stop, open, go, text, shot } from './lib.mjs';
await start();
for (const dev of ['desktop', 'phone']) {
  const { page, context } = await open('owner', '/biz/journal?booking=bk_1892', { device: dev });
  await page.waitForTimeout(1500);
  const dlg = page.locator('[role=dialog]').last();
  console.log(dev, 'dialogs', await page.locator('[role=dialog]').count(), '|', (await dlg.innerText().catch(()=>'')).replace(/\n/g, ' | ').slice(0, 160));
  await shot(page, 'J8-booking-other-date-' + dev);
  await context.close();
}
await stop();
