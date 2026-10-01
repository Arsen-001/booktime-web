// Ссылки на карточки строк текущего списка: кликаем строку, запоминаем адрес, возвращаемся
export async function rowHrefs(page, max = 4) {
  const out = [];
  const listUrl = page.url();
  const n = Math.min(max, await page.locator('table tbody tr').count());
  for (let i = 0; i < n; i++) {
    await page.locator('table tbody tr').nth(i).locator('td').nth(1).click();
    await page.waitForURL(/\/biz\/clients\/[^/?]+$/, { timeout: 15000 }).catch(() => {});
    out.push(new URL(page.url()).pathname);
    await page.goBack(); await page.waitForTimeout(1500);
    if (page.url() !== listUrl) await page.goto(listUrl);
  }
  return out;
}
