const BK = 'bk_01M3TBX8Y7J5RG0HMHFNG1EFNW';
export default async ({ go, shot, page }) => {
  await go(`/biz/journal?date=2026-10-01&booking=${BK}`, 4000);
  await page.locator('[role=dialog]').last().getByRole('button', { name: 'Выдать карту' }).first().click();
  await page.waitForTimeout(1500);
  const d = page.locator('[role=dialog]').last();
  const opts = await d.locator('select').first().locator('option').allInnerTexts();
  await shot('l4-issue-options', false);
  return { opts };
};
