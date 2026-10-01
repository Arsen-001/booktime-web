// Категории: создать → назначить массово → фильтр по категории → удалить
export default async ({ page, go, shot, text }) => {
  const r = {};
  const cat = `ТестКат${String(Date.now()).slice(-4)}`;
  await go('/biz/clients/categories');
  r.head = (await text()).slice(0, 600);
  await shot('s10-categories');
  await page.getByRole('button', { name: /Добавить категорию/ }).first().click(); await page.waitForTimeout(700);
  const dlg = page.locator('[role=dialog]').last();
  await dlg.getByRole('button', { name: /^Сохранить$/ }).click(); await page.waitForTimeout(400);
  r.emptyErr = (await dlg.innerText()).includes('Укажите название');
  await dlg.getByLabel(/Название/).fill(cat);
  await dlg.getByRole('button', { name: /^Сохранить$/ }).click(); await page.waitForTimeout(1500);
  r.created = (await text()).includes(cat);
  // дубль
  await page.getByRole('button', { name: /Добавить категорию/ }).first().click(); await page.waitForTimeout(700);
  const d2 = page.locator('[role=dialog]').last();
  await d2.getByLabel(/Название/).fill(cat.toLowerCase());
  await d2.getByRole('button', { name: /^Сохранить$/ }).click(); await page.waitForTimeout(700);
  r.dupErr = (await d2.innerText().catch(() => '')).includes('уже есть');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  // массово назначить двум первым клиентам
  await go('/biz/clients');
  await page.getByRole('button', { name: /^Выбрать$/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  const boxes = page.locator('table tbody tr [role=checkbox], table tbody tr input[type=checkbox]');
  r.boxes = await boxes.count();
  if (r.boxes >= 2) { await boxes.nth(0).click(); await boxes.nth(1).click(); }
  await page.waitForTimeout(500);
  r.bulkBar = (await text()).match(/Выбрано[^\n]*/)?.[0];
  await shot('s10-bulk');
  r.bulkButtons = (await page.getByRole('button').allInnerTexts()).filter((s) => s.trim()).slice(0, 40);
  const catBtn = page.getByRole('button', { name: /категори/i }).first();
  if (await catBtn.count()) {
    await catBtn.click(); await page.waitForTimeout(700);
    const d3 = page.locator('[role=dialog]').last();
    r.bulkDlg = (await d3.innerText()).slice(0, 500);
    const inp = d3.locator('input').first();
    await inp.fill(cat); await page.waitForTimeout(500);
    await page.getByRole('option', { name: new RegExp(cat) }).first().click().catch(async () => { await page.keyboard.press('Enter'); });
    await page.waitForTimeout(300);
    await d3.getByRole('button', { name: /Добавить|Сохранить|Применить/ }).last().click(); await page.waitForTimeout(1500);
  }
  await go(`/biz/clients?category=${encodeURIComponent(cat)}`);
  r.filtered = await page.locator('table tbody tr').count();
  r.filteredText = (await text()).slice(0, 500);
  await go('/biz/clients/categories');
  r.catCount = (await text()).split('\n').filter((l) => l.includes(cat) || /клиент/.test(l)).slice(0, 6);
  // удалить
  await page.getByText(cat, { exact: true }).first().click(); await page.waitForTimeout(700);
  await page.getByRole('button', { name: /Удалить категорию/ }).click().catch(() => {}); await page.waitForTimeout(600);
  const c = page.locator('[role=alertdialog]').last();
  r.delConfirm = (await c.innerText().catch(() => '')).slice(0, 300);
  await c.getByRole('button', { name: /Удалить/ }).last().click().catch(() => {}); await page.waitForTimeout(1500);
  r.deleted = !(await text()).includes(cat);
  await go(`/biz/clients?category=${encodeURIComponent(cat)}`);
  r.afterDelFiltered = await page.locator('table tbody tr').count();
  r.cat = cat;
  return r;
};
