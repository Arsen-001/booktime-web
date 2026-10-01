const BK = 'bk_01M3TBX8Y7J5RG0HMHFNG1EFNW';
export default async ({ go, shot, page, api }) => {
  const r = {};
  await go(`/biz/journal?date=2026-10-01&booking=${BK}`, 4000);
  const d = page.locator('[role=dialog]').last();
  await d.getByRole('tab', { name: 'Товары' }).first().click();
  await page.waitForTimeout(1500);
  await d.getByRole('button', { name: /Пилка одноразовая/ }).click();
  await page.waitForTimeout(1500);
  await shot('k2-goods-line', false);
  const line = d.locator('div').filter({ hasText: /^Пилка одноразовая/ }).first();
  r.selects = await d.locator('select').evaluateAll((els) => els.map((e) => [...e.options].map((o) => o.text).join('/')).filter((x) => /Ани|Мариам/.test(x)));
  // продавец строки — последний селект с мастерами
  const sel = d.locator('select').filter({ has: page.locator('option', { hasText: 'Мариам Петросян' }) });
  r.selCount = await sel.count();
  await sel.last().selectOption({ label: 'Мариам Петросян' });
  await page.waitForTimeout(800);
  await d.getByRole('button', { name: 'Сохранить изменения' }).click();
  await page.waitForTimeout(5000);
  const ex = await api('POST', '/v1/biz/biz_nuri/bookings/extras', { ids: [BK] });
  r.goods = JSON.stringify(ex.data[BK]?.goodsLines).slice(0, 300);
  return r;
};
