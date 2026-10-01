export default async ({ go, shot, page, text }) => {
  const r = {};
  await go('/biz/loyalty/memberships', 4000);
  r.t = (await text()).slice(0, 500);
  await page.getByRole('button', { name: 'Продать абонемент' }).first().click();
  await page.waitForTimeout(2000);
  const d = page.locator('[role=dialog]').last();
  r.dlg = (await d.innerText()).slice(0, 700);
  r.inputs = await d.locator('input, button[role=combobox], select').evaluateAll((els) => els.map((e) => `${e.tagName}|${e.getAttribute('placeholder') || ''}|${e.getAttribute('aria-label') || ''}|${(e.textContent || '').slice(0, 30)}`));
  await shot('l1-sell-dlg', false);
  return r;
};
