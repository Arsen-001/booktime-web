const BK = 'bk_01M3TBT40E7TZFN809Y79P5XHT';
export default async ({ go, shot, page, api }) => {
  const r = {};
  await go(`/biz/journal?date=2026-10-01&booking=${BK}`, 4000);
  await page.locator('[role=dialog]').last().getByRole('button', { name: /Посмотреть детали|^Оплатить/ }).last().click().catch(() => {});
  await page.waitForTimeout(2000);
  r.d0 = (await page.locator('[role=dialog]').last().innerText()).slice(0, 200);
  await page.locator('[role=dialog]').last().getByRole('button', { name: "Отменить платёж" }).first().click();
  await page.waitForTimeout(1200);
  const yes = page.locator('[role=alertdialog], [role=dialog]').last().getByRole('button', { name: /^(Удалить|Да|Отменить оплату|Подтвердить)/ });
  r.confirm = await yes.count();
  if (r.confirm) await yes.last().click();
  await page.waitForTimeout(4000);
  await shot('s9-cancel-line', false);
  r.d1 = (await page.locator('[role=dialog]').last().innerText()).slice(0, 250);
  const sum = await api('GET', `/v1/biz/biz_nuri/finance/bookings/${BK}/payments`);
  r.summary = { due: sum.data.due, lines: sum.data.moneyLines?.map((l) => [l.id, l.amount, l.cancelled]), payments: sum.data.payments };
  return r;
};
