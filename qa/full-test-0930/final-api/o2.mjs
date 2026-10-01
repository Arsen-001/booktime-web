const BK = 'bk_01M3TDG4VHSECN6BD1JFBWEYKM';
export default async ({ go, shot, page, ctx, api }) => {
  const r = {};
  await ctx.clearCookies();
  await ctx.addCookies([{ name: 'bt_data', value: 'api', domain: 'localhost', path: '/' }]);
  await go(`/b/nuri-nail-studio/booking/${BK}?h=qafinalhash0001`, 4000);
  await shot('o2-client-offer');
  r.t = (await page.innerText('body')).slice(0, 900);
  const btn = page.getByRole('button', { name: /10:00/ }).first();
  r.btn = await btn.count();
  if (r.btn) { await btn.click(); await page.waitForTimeout(1500);
    const conf = page.locator('[role=dialog]').last().getByRole('button', { name: /Записаться|Да|Подтвердить/ });
    if (await conf.count()) await conf.last().click();
    await page.waitForTimeout(4000);
    await shot('o2-client-booked');
    r.after = (await page.innerText('body')).slice(0, 600); r.url = page.url(); }
  return r;
};
