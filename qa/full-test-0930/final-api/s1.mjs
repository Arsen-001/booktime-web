export default async ({ go, shot, text, page }) => {
  await go('/biz/journal');
  await page.getByRole('button', { name: 'Новая запись' }).first().click();
  await page.waitForTimeout(1200);
  await page.locator('[role=dialog]').last().getByText('Запись', { exact: true }).click();
  await page.waitForTimeout(5000);
  const dl = await page.$$eval('[role=dialog]', (ds) => ds.map((d) => ({ box: JSON.stringify(d.getBoundingClientRect()), vis: getComputedStyle(d).visibility, op: getComputedStyle(d).opacity, len: d.innerHTML.length, txt: d.innerText.slice(0, 200) })));
  await shot('s1-form', true);
  return { dl, url: page.url() };
};
