const page = state.e;
await L.go(page, '/biz/services/templates'); await page.waitForTimeout(1500);
const cnt = async () => (await page.innerText('main')).match(/Выбрано: \d+/)?.[0];
for (const n of ['Детский маникюр', 'Снятие покрытия', 'Классический педикюр']) {
  await page.getByRole('checkbox', { name: n }).click(); await page.waitForTimeout(400);
  log(n, await page.getByRole('checkbox', { name: n }).isChecked(), await cnt());
}
await L.shot(page, 'services', 'e03-templates-multi');
