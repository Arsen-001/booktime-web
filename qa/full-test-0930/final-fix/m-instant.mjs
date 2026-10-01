// Мок: «Оплатить» во всплывающей карточке → касса и окно показывают одну оплату (без задвоения строки)
export default async ({ page, go, shot }) => {
  const r = {};
  await go('/biz/journal?demo=owner&date=2026-10-02', 5000);
  const block = page.locator('[aria-label="15:00–16:45, Нелли Г., Маникюр с покрытием гель-лаком, Записан, Coral 144"]').first();
  await block.hover(); await page.waitForTimeout(1500);
  const btn = page.getByRole('button', { name: /^Наличные$/ });
  r.btns = await btn.count();
  if (r.btns) { await btn.first().click(); await page.waitForTimeout(3500); }
  await shot('instant-after', false);
  await block.click(); await page.waitForTimeout(3000);
  const dlg = page.locator('[role=dialog]').last();
  await dlg.getByRole('button', { name: /Оплачено|Оплатить/ }).last().click().catch(() => {});
  await page.waitForTimeout(2000);
  r.sheet = (await dlg.innerText()).replace(/\s+/g, ' ').slice(0, 300);
  await shot('instant-sheet', false);
  return r;
};
