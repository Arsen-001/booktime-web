// Добавить клиента → в списке; дубль номера → открывается существующая; пустая форма → ошибки под полями
export default async ({ page, go, shot, text }) => {
  const r = {};
  await go('/biz/clients?empty=0');
  const addBtn = page.getByRole('button', { name: /Добавить клиента/ }).first();
  await addBtn.click(); await page.waitForTimeout(800);
  const dlg = page.locator('[role=dialog]').last();
  await shot('s06-add-open');
  r.formText = (await dlg.innerText()).slice(0, 1200);
  // пустая отправка
  await dlg.getByRole('button', { name: /^Добавить$/ }).click(); await page.waitForTimeout(600);
  r.emptyErrors = (await dlg.innerText()).match(/Укажите имя|Введите номер[^\n]*/g);
  await shot('s06-add-errors');
  const stamp = String(Date.now()).slice(-6);
  const name = `Тест Проверкин ${stamp}`;
  await dlg.getByLabel(/^Имя/).first().fill(name);
  const phone = dlg.locator('input[inputmode=tel]').first();
  await phone.fill(`77${stamp}`);
  await dlg.getByRole('button', { name: /^Добавить$/ }).click(); await page.waitForTimeout(2000);
  r.afterAdd = (await text()).slice(0, 400);
  r.toast = await page.locator('[data-sonner-toast], [role=status]').allInnerTexts().catch(() => []);
  r.inList = (await text()).includes(name.split(' ')[0]) && (await text()).includes(stamp);
  await shot('s06-added');
  // дубль
  await page.getByRole('button', { name: /Добавить клиента/ }).first().click(); await page.waitForTimeout(800);
  const dlg2 = page.locator('[role=dialog]').last();
  await dlg2.getByLabel(/^Имя/).first().fill('Дубль Номера');
  await dlg2.locator('input[inputmode=tel]').first().fill(`77${stamp}`);
  await dlg2.getByRole('button', { name: /^Добавить$/ }).click(); await page.waitForTimeout(2500);
  r.dupUrl = page.url();
  r.dupText = (await text()).slice(0, 300);
  r.dupToast = await page.locator('[data-sonner-toast], [role=status]').allInnerTexts().catch(() => []);
  await shot('s06-dup');
  // поиск созданного и число «Дубль Номера» в базе
  await go(`/biz/clients?q=${encodeURIComponent('Дубль Номера')}`);
  r.dupCreated = (await page.locator('table tbody tr').allInnerTexts()).filter((s) => s.includes('Дубль')).length;
  r.stamp = stamp; r.name = name;
  return r;
};
