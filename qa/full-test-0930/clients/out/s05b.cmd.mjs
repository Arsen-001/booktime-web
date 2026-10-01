export default async ({ page, go, shot, text }) => {
  const r = {};
  await go('/biz/clients?empty=0');
  const search = page.getByPlaceholder('Имя, телефон, email').first();
  r.found = await search.count();
  const rowsNow = async () => (await page.locator('table tbody tr').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').trim().slice(0, 50));
  const counter = async () => (await text()).match(/(Найдено[^\n]*|\d+ клиент[^\n]*)/)?.[0];
  await search.fill('Гаяне'); await page.waitForTimeout(2000);
  r.byName = { rows: await rowsNow(), c: await counter(), url: page.url() };
  await search.fill('945 562'); await page.waitForTimeout(2000);
  r.byPhoneSpaced = { rows: await rowsNow(), c: await counter() };
  await search.fill('+374 98 945 562'); await page.waitForTimeout(2000);
  r.byPhoneFull = { rows: await rowsNow(), c: await counter() };
  await search.fill('гаяне ТОВ'); await page.waitForTimeout(2000);
  r.byCase = { rows: await rowsNow(), c: await counter() };
  await search.fill('zzqxw нетакого'); await page.waitForTimeout(2000);
  r.none = (await text()).slice(-500); await shot('s05-search-empty');
  const reset = page.getByRole('button', { name: /Сбросить/ }).first();
  r.resetExists = await reset.count();
  if (r.resetExists) { await reset.click(); await page.waitForTimeout(1500); r.afterReset = await search.inputValue(); r.afterResetC = await counter(); }
  // фильтр: пол + применить, сверка счётчика
  await page.getByRole('button', { name: /^Фильтры/ }).first().click(); await page.waitForTimeout(1000);
  const dlg = page.locator('[role=dialog]').last();
  await dlg.getByRole('button', { name: /По клиентам/ }).click().catch(() => {}); await page.waitForTimeout(500);
  r.clientsGroup = (await dlg.innerText()).slice(0, 1500);
  await dlg.getByRole('button', { name: /^Пришёл$/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  const show = dlg.getByRole('button', { name: /^Показать/ });
  r.showLabel = await show.innerText();
  await show.click(); await page.waitForTimeout(2000);
  r.afterFilter = { c: await counter(), chips: (await text()).slice(0, 600) };
  await shot('s05-filter-applied');
  return r;
};
