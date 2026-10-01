export default async ({ page, go, shot, text }) => {
  const r = {};
  await go('/biz/clients/categories');
  r.list = (await text()).slice(0, 700);
  await go(`/biz/clients?category=${encodeURIComponent('ТестКат7660')}`);
  r.filtered = (await text()).match(/Найдено[^\n]*/)?.[0];
  // открыть карточку Гагика — категории у него
  await go('/biz/clients?q=' + encodeURIComponent('Гагик Петросян'));
  await page.locator('table tbody tr').first().locator('td').nth(1).click();
  await page.waitForURL(/\/biz\/clients\/[^/?]+$/).catch(() => {});
  await page.waitForTimeout(1500);
  await page.getByRole('tab', { name: /О клиенте/ }).click().catch(() => {});
  await page.waitForTimeout(1200);
  r.about = (await text()).slice(0, 1500);
  await shot('s10b-about');
  return r;
};
