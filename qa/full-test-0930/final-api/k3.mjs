const BK = 'bk_01M3TBX8Y7J5RG0HMHFNG1EFNW';
export default async ({ go, shot, page, api }) => {
  const r = {};
  await go(`/biz/journal?date=2026-10-01&booking=${BK}`, 4000);
  await page.locator('[role=dialog]').last().getByRole('button', { name: /^Оплатить/ }).last().click();
  await page.waitForTimeout(2000);
  r.sheet = (await page.locator('[role=dialog]').last().innerText()).slice(0, 200);
  await page.locator('[role=dialog]').last().getByRole('button', { name: /Наличные/ }).last().click();
  await page.waitForTimeout(6000);
  await shot('k3-paid-goods', false);
  const s = await api('GET', `/v1/biz/biz_nuri/finance/bookings/${BK}/payments`);
  r.due = s.data.due; r.lines = s.data.moneyLines.map((l) => [l.amount, l.goods, l.cancelled]);
  return r;
};
