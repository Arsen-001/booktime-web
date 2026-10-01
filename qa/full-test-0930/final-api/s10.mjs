const BK = 'bk_01M3TBX8Y7J5RG0HMHFNG1EFNW';
export default async ({ go, page, api }) => {
  const r = {};
  await go(`/biz/journal?date=2026-10-01&booking=${BK}`, 4000);
  const dlg = page.locator('[role=dialog]').last();
  await dlg.locator('textarea').first().fill('QA коммент');
  await dlg.getByRole('button', { name: /Сохранить изменения/ }).click();
  await page.waitForTimeout(1500);
  r.confirmShown = await page.getByText('Вне графика мастера').count();
  await page.waitForTimeout(2500);
  r.comment = (await api('GET', `/v1/biz/biz_nuri/bookings/${BK}`)).data.comment;
  return r;
};
