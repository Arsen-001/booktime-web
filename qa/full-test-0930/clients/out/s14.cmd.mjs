export default async ({ page, go, shot, text }) => {
  const r = {};
  const cat = 'ТестКат7660';
  await go('/biz/clients/categories');
  await page.locator('li').filter({ hasText: cat }).getByRole('button', { name: 'Ещё' }).click(); await page.waitForTimeout(600);
  await page.getByRole('menuitem', { name: /Удалить категорию/ }).click(); await page.waitForTimeout(800);
  r.confirm = await page.locator('[role=dialog], [role=alertdialog]').allInnerTexts();
  await page.locator('[role=dialog] button, [role=alertdialog] button').filter({ hasText: /^Удалить/ }).last().click(); await page.waitForTimeout(2000);
  await go('/biz/clients/categories');
  r.stillListed = (await text()).includes(cat);
  await go(`/biz/clients?category=${encodeURIComponent(cat)}`);
  r.filtered = (await text()).match(/Найдено[^\n]*/)?.[0];
  // категория в другом бизнесе (утечка справочника между бизнесами): индивидуал
  await go('/biz/clients/categories', { persona: 'owner' });
  await page.getByRole('button', { name: /Добавить категорию/ }).first().click(); await page.waitForTimeout(700);
  const leak = `Утечка${String(Date.now()).slice(-4)}`;
  await page.locator('[role=dialog]').last().getByLabel(/Название/).fill(leak);
  await page.locator('[role=dialog]').last().getByRole('button', { name: /^Сохранить$/ }).click(); await page.waitForTimeout(1500);
  await go('/biz/clients/categories', { persona: 'individual' });
  r.leakInOtherBiz = (await text()).includes(leak);
  await shot('s14-individual-categories');
  r.leak = leak;
  // режим api: чип «Пора записать» скрыт
  await go('/biz/clients?data=api');
  r.apiUrl = page.url();
  r.apiText = (await text()).slice(0, 400);
  r.apiChip = await page.getByRole('button', { name: /Пора записать/ }).count();
  await shot('s14-api-mode');
  await go('/biz/clients?data=mock');
  r.mockChip = await page.getByRole('button', { name: /Пора записать/ }).count();
  r.mockText = (await text()).slice(0, 250);
  return r;
};
