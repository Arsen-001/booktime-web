// Поиск, пустой поиск, фильтры, сортировка, пагинация
export default async ({ page, go, shot, text }) => {
  const r = {};
  await go('/biz/clients?empty=0');
  const total0 = (await text()).match(/(\d[\d\s]*)\s+клиент/)?.[0];
  r.total0 = total0;
  const rows = await page.locator('table tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim())));
  r.firstRows = rows.slice(0, 3);
  const headers = await page.locator('table thead th').evaluateAll((ths) => ths.map((t) => t.innerText.trim()));
  r.headers = headers;
  const nameCell = rows[0]?.find((c) => /[А-Яа-яA-Za-z]{3}/.test(c) && !/\d/.test(c)) ?? '';
  const phoneCell = rows[0]?.find((c) => /\+?\d[\d\s]{7,}/.test(c)) ?? '';
  r.nameCell = nameCell; r.phoneCell = phoneCell;
  const search = page.getByRole('searchbox').or(page.locator('input[type=search]')).first();
  const part = nameCell.split(/\s+/)[0].slice(0, 4).toLowerCase();
  await search.fill(part); await page.waitForTimeout(1500);
  r.byName = { q: part, rows: (await page.locator('table tbody tr').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').slice(0, 60)).slice(0, 5), counter: (await text()).match(/Найдено[^\n]*/)?.[0] };
  const digits = phoneCell.replace(/\D/g, '').slice(-6);
  const spaced = `${digits.slice(0, 3)} ${digits.slice(3)}`;
  await search.fill(spaced); await page.waitForTimeout(1500);
  r.byPhone = { q: spaced, rows: (await page.locator('table tbody tr').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').slice(0, 60)).slice(0, 5) };
  await search.fill('zzqxw нетакого'); await page.waitForTimeout(1500);
  r.none = (await text()).slice(0, 600); await shot('s05-search-empty');
  const reset = page.getByRole('button', { name: /Сбросить/ }).first();
  r.resetExists = await reset.count();
  if (r.resetExists) { await reset.click(); await page.waitForTimeout(1200); r.afterReset = (await search.inputValue()); r.afterResetRows = await page.locator('table tbody tr').count(); }
  // сортировка по имени
  const nameTh = page.locator('table thead th').filter({ hasText: /Имя|Клиент/ }).first();
  const sortBtn = nameTh.locator('button').first();
  if (await sortBtn.count()) {
    await sortBtn.click(); await page.waitForTimeout(1200);
    r.sortAsc = (await page.locator('table tbody tr td:nth-child(2)').allInnerTexts()).slice(0, 5);
    await sortBtn.click(); await page.waitForTimeout(1200);
    r.sortDesc = (await page.locator('table tbody tr td:nth-child(2)').allInnerTexts()).slice(0, 5);
  }
  // фильтры
  await go('/biz/clients?empty=0');
  await page.getByRole('button', { name: /^Фильтры/ }).first().click(); await page.waitForTimeout(1000);
  await shot('s05-filters-open');
  r.filterSheet = (await page.locator('[role=dialog]').last().innerText()).slice(0, 1500);
  return r;
};
