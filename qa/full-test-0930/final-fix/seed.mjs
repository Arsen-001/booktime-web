// Мок: засеянный оплаченный визит → окно «Оплата визита» показывает строку → частичный возврат → отмена
export default async ({ page, go, shot }) => {
  const r = {};
  const dlg = () => page.locator('[role=dialog]').last();
  const txt = async () => (await dlg().innerText()).replace(/\s+/g, ' ').slice(0, 300);
  await go('/biz/journal?demo=owner&date=2026-09-30', 5000);
  await page.getByRole('radio', { name: 'Список' }).or(page.getByRole('tab', { name: 'Список' })).or(page.getByRole('button', { name: 'Список' })).first().click();
  await page.waitForTimeout(3000);
  const rows = page.locator('[data-list-open]');
  const n = await rows.count();
  let opened = false;
  for (let i = 0; i < n && !opened; i++) {
    const row = rows.nth(i).locator('xpath=..');
    if (/Оплачено/.test(await row.innerText())) { r.row = (await row.innerText()).replace(/\s+/g, ' '); await rows.nth(i).click(); opened = true; }
  }
  await page.waitForTimeout(3000);
  r.window = (await dlg().innerText()).split('\n').filter((l) => /плач|К оплате/.test(l)).slice(0, 4);
  await dlg().getByRole('button', { name: process.env.VIEW }).click(); await page.waitForTimeout(2000);
  r.sheet = await txt();
  await shot('seed-1-sheet', false);
  await dlg().getByRole('button', { name: 'Частичный возврат' }).first().click(); await page.waitForTimeout(400);
  await dlg().locator('input').first().fill('500');
  await dlg().getByRole('button', { name: /^Вернуть$/ }).click(); await page.waitForTimeout(3500);
  r.afterRefund = await txt();
  await shot('seed-2-refund', false);
  await dlg().getByRole('button', { name: 'Отменить платёж' }).first().click(); await page.waitForTimeout(3500);
  r.afterCancel = await txt();
  await shot('seed-3-cancel', false);
  await page.keyboard.press('Escape'); await page.waitForTimeout(800);
  await dlg().getByRole('tab', { name: /^Оплата/ }).click(); await page.waitForTimeout(3000);
  r.financeTab = await txt();
  return r;
};
