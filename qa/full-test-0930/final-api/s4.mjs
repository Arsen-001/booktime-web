const BK = 'bk_01M3TB3D8CH97A89S0VF8K6EDH';
export default async ({ go, shot, page, api, text }) => {
  const r = {};
  await go(`/biz/journal?date=2026-10-01&booking=${BK}`, 4000);
  await page.locator('[role=dialog]').last().getByRole('button', { name: /^Оплатить/ }).last().click();
  await page.waitForTimeout(2000);
  await page.locator('[role=dialog]').last().getByRole('button', { name: /Наличные/ }).click();
  await page.waitForTimeout(3000);
  await shot('s4-paid', false);
  const b = (await api('GET', `/v1/biz/biz_nuri/bookings/${BK}`)).data;
  r.paid = { status: b?.status, paidAmount: b?.paidAmount, payments: b?.payments };
  const ops = (await api('GET', `/v1/biz/biz_nuri/finance/fin-ops?from=2026-10-01&to=2026-10-01`)).data;
  r.ops = JSON.stringify(ops).slice(0, 1200);
  await go('/biz/finance', 3500);
  await shot('s4-finance');
  r.fin = (await text()).slice(0, 900);
  return r;
};
