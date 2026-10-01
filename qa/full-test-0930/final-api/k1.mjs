const BK = 'bk_01M3TBX8Y7J5RG0HMHFNG1EFNW';
export default async ({ go, shot, page }) => {
  const r = {};
  await go(`/biz/journal?date=2026-10-01&booking=${BK}`, 4000);
  const d = page.locator('[role=dialog]').last();
  await d.getByRole('tab', { name: 'Товары' }).first().click().catch(async () => d.getByText('Товары', { exact: true }).first().click());
  await page.waitForTimeout(2000);
  await shot('k1-goods-tab', false);
  r.btns = (await d.locator('button').allInnerTexts()).filter(Boolean).slice(0, 60);
  return r;
};
