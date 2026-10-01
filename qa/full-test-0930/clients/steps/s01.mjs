export default async ({ page, go, shot, text }) => {
  await go('/biz/clients');
  const before = await text();
  await shot('s01-list-desktop');
  const chip = page.getByRole('button', { name: /Пора записать/ }).first();
  const chipText = await chip.innerText();
  await chip.click();
  await page.waitForTimeout(2000);
  await shot('s01-due-desktop');
  const after = await text();
  const rows = await page.locator('table tbody tr').evaluateAll((trs) => trs.map((tr) => tr.innerText.replace(/\s+/g, ' ').slice(0, 160)));
  const headers = await page.locator('table thead th').evaluateAll((ths) => ths.map((t) => t.innerText));
  return { chipText, beforeHead: before.slice(0, 600), afterHead: after.slice(0, 400), headers, rows: rows.slice(0, 30), nrows: rows.length, url: page.url() };
};
