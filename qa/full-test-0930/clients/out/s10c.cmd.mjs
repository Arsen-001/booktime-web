export default async ({ page, go, shot, text }) => {
  const r = {};
  const cat = 'ТестКат7660';
  await go('/biz/clients/categories');
  const row = page.locator('li, [role=listitem], tr, div').filter({ hasText: new RegExp(`^${cat}`) }).last();
  r.rowBtns = await page.getByRole('button').allInnerTexts();
  await page.getByRole('button', { name: new RegExp(cat) }).first().click().catch(async () => { await page.getByText(cat).first().click(); });
  await page.waitForTimeout(900);
  r.dialogs = await page.locator('[role=dialog], [role=menu]').allInnerTexts();
  await shot('s10c-cat-open');
  const del = page.getByRole('button', { name: /Удалить категорию/ }).or(page.getByRole('menuitem', { name: /Удалить/ })).first();
  r.hasDel = await del.count();
  if (r.hasDel) {
    await del.click(); await page.waitForTimeout(900);
    r.confirm = await page.locator('[role=dialog], [role=alertdialog]').allInnerTexts();
    await page.locator('[role=dialog] button, [role=alertdialog] button').filter({ hasText: /^Удалить/ }).last().click(); await page.waitForTimeout(2000);
  }
  await go('/biz/clients/categories');
  r.after = (await text()).includes(cat);
  await go(`/biz/clients?category=${encodeURIComponent(cat)}`);
  r.filtered = (await text()).match(/Найдено[^\n]*/)?.[0];
  return r;
};
