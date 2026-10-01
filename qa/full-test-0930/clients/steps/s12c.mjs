// Сколько клиентов с последним визитом «Маникюр классический» и без будущей записи — по фильтру «Услуги»
export default async ({ page, go, text }) => {
  await go('/biz/clients');
  await page.getByRole('button', { name: /Пора записать/ }).first().click(); await page.waitForTimeout(1500);
  const rows = [];
  const n = await page.locator('table tbody tr').count();
  for (let i = 0; i < Math.min(n, 3); i++) {
    await page.locator('table tbody tr').nth(i).locator('td').nth(1).click();
    await page.waitForURL(/\/biz\/clients\/[^/?]+$/).catch(() => {});
    await page.waitForTimeout(1500);
    const strip = await page.locator('[data-f~="F-00-084"]').first().innerText().catch(() => null);
    const t = (await text()).slice(0, 1400);
    rows.push({ url: page.url(), strip, t });
    await page.goBack(); await page.waitForTimeout(1500);
  }
  return rows;
};
