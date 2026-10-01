const BK = 'bk_01M3TBX8Y7J5RG0HMHFNG1EFNW';
export default async ({ go, shot, page }) => {
  const r = {};
  await go(`/biz/journal?date=2026-10-01&booking=${BK}`, 4000);
  r.win = (await page.locator('[role=dialog]').last().innerText()).match(/К оплате[\s\S]{0,80}/g);
  await page.locator('[role=dialog]').last().getByRole('button', { name: /^Оплатить/ }).last().click().catch((e) => { r.noPay = String(e).slice(0, 80); });
  await page.waitForTimeout(2500);
  r.sheet = (await page.locator('[role=dialog]').last().innerText()).slice(0, 300);
  await shot('s8-after-refund-reopen', false);
  return r;
};
