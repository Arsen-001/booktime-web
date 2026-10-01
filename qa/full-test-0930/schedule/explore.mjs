import { withBrowser, ctx, go, shot } from './lib.mjs';
await withBrowser(async (b) => {
  const { page, errors } = await ctx(b);
  await go(page, '/biz/schedule');
  await shot(page, 'x-schedule');
  const cells = await page.$$eval('[data-cell]', (els) => els.slice(0, 20).map((e) => e.getAttribute('data-cell') + ' :: ' + e.innerText.replace(/\n/g, ' ')));
  console.log(cells.join('\n'));
  console.log((await page.innerText('main')).slice(0, 1500));
  console.log(errors);
});
