const BK = 'bk_01M3TB3D8CH97A89S0VF8K6EDH';
export default async ({ go, shot, page, api }) => {
  const r = {};
  await go(`/biz/journal?date=2026-10-01&booking=${BK}`, 4000);
  const dlg = page.locator('[role=dialog]').last();
  await dlg.getByRole('button', { name: /^Пришёл/ }).first().click();
  await page.waitForTimeout(2500);
  await shot('s3-arrived', false);
  r.afterArrived = (await api('GET', `/v1/biz/biz_nuri/bookings/${BK}`)).data?.status;
  r.btns = (await page.locator('[role=dialog]').last().locator('button').allInnerTexts()).filter(Boolean).slice(-8);
  await page.locator('[role=dialog]').last().getByRole('button', { name: /^Оплатить/ }).last().click();
  await page.waitForTimeout(2500);
  await shot('s3-pay', false);
  r.payDlg = (await page.locator('[role=dialog]').last().innerText()).slice(0, 900);
  return r;
};
