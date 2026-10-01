// Мок: «Предложить другое время» — свободные окна отправляются (проверка сервера-мока их пропускает)
export default async ({ page, go, shot }) => {
  const r = {};
  await go('/biz/online/requests?demo=owner', 5000);
  r.page = (await page.innerText('main')).slice(0, 300);
  if (!(await page.getByRole('button', { name: 'Другое время' }).count())) return r;
  await page.getByRole('button', { name: 'Другое время' }).first().click(); await page.waitForTimeout(2500);
  const d = page.locator('[role=dialog]').last();
  const slots = d.locator('button[aria-pressed]');
  r.slots = await slots.count();
  await slots.nth(0).click(); await slots.nth(1).click();
  await d.getByRole('button', { name: /^Отправить/ }).click(); await page.waitForTimeout(2500);
  r.toast = (await page.locator('[role=status], [data-sonner-toast], [role=alert]').allInnerTexts()).join(' | ').slice(0, 200);
  await shot('offer-sent', false);
  r.after = (await page.innerText('main')).split('\n').filter((l) => /Предложено/.test(l)).slice(0, 3);
  return r;
};
