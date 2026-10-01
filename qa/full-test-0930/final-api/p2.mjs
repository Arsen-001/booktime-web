const BK = 'bk_01M3TCACCYT4E8G7B9E3YJ7F9H';
export default async ({ go, shot, page, api, text }) => {
  const r = {};
  await go('/biz/online/requests', 3500);
  await shot('p2-requests');
  const card = page.locator('article, li, [data-booking-id], div').filter({ hasText: 'QA Финал' }).filter({ has: page.getByRole('button', { name: 'Деньги пришли' }) }).last();
  r.found = await card.count();
  await card.getByRole('button', { name: 'Деньги пришли' }).click();
  await page.waitForTimeout(3000);
  await shot('p2-received');
  const b = (await api('GET', `/v1/biz/biz_nuri/bookings/${BK}`)).data;
  r.after = { status: b.status, prepayment: b.prepayment };
  r.sum = (await api('GET', `/v1/biz/biz_nuri/finance/bookings/${BK}/payments`)).data?.due;
  return r;
};
