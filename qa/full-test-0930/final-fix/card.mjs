// Всплывающая карточка «Статус и оплата» → «Банковские карты»: операция «карта» в кассе карты; окно — строка оплаты
export default async ({ page, go, shot }) => {
  const r = {};
  const P = process.env.MODE === 'mock' ? 'demo=owner&' : '';
  await go(`/biz/journal?${P}date=${process.env.DATE}`, 5000);
  const block = page.locator(`[aria-label^="${process.env.LABEL}"]`).first();
  const wrap = block.locator('xpath=..');
  await wrap.getByRole('button', { name: 'Статус и оплата' }).first().click(); await page.waitForTimeout(1500);
  await shot('card-popover', false);
  await page.getByRole('button', { name: 'Банковские карты' }).first().click(); await page.waitForTimeout(4000);
  r.toast = (await page.locator('[role=status],[data-sonner-toast]').allInnerTexts()).join(' | ').slice(0, 120);
  await page.keyboard.press('Escape');
  await block.click(); await page.waitForTimeout(3000);
  const dlg = page.locator('[role=dialog]').last();
  await dlg.getByRole('tab', { name: /^Оплата/ }).click(); await page.waitForTimeout(3000);
  r.financeTab = (await dlg.innerText()).replace(/\s+/g, ' ').slice(0, 330);
  await shot('card-finance-tab', false);
  return r;
};
