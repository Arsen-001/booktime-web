import { ctx, go, shot } from './lib.mjs';
export async function run(b) {
  let { c, page } = await ctx(b, { device: 'phone' });
  await go(page, '/biz/schedule'); await page.waitForTimeout(1500); await shot(page, 'fix-phone-periodnav');
  await c.close();
  ({ c, page } = await ctx(b, { device: 'phone', extra: '&api=error' }));
  await go(page, '/biz/schedule/calendar'); await page.waitForTimeout(4000); await shot(page, 'fix-calendar-error');
  console.log('[calendar api=error]', (await page.innerText('main')).replace(/\s+/g, ' ').slice(0, 200));
  await c.close();
}
