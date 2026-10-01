const BK = 'bk_01M3TBX8Y7J5RG0HMHFNG1EFNW';
export default async ({ go, page }) => {
  await go(`/biz/journal?date=2026-10-01&booking=${BK}`, 4000);
  const d = page.locator('[role=dialog]').last();
  await d.getByRole('tab', { name: 'Товары' }).first().click();
  await page.waitForTimeout(1500);
  const sel = d.locator('select').filter({ has: page.locator('option', { hasText: 'Сона Григорян' }) });
  await sel.last().selectOption({ label: 'Сона Григорян' });
  await page.waitForTimeout(800);
  await d.getByRole('button', { name: 'Сохранить изменения' }).click();
  await page.waitForTimeout(6000);
  return {};
};
