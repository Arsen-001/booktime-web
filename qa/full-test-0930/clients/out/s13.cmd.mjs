// Перепроверка починок: подборка в адресе и «назад», мастер — чужой клиент, журнал без «Пол», автор импорта
export default async ({ page, go, shot, text }) => {
  const r = {};
  await go('/biz/clients');
  await page.getByRole('button', { name: /Пора записать/ }).first().click(); await page.waitForTimeout(1500);
  r.urlAfterPick = page.url();
  r.firstDue = (await page.locator('table tbody tr').first().innerText()).replace(/\s+/g, ' ').slice(0, 60);
  await page.locator('table tbody tr').first().locator('td').nth(1).click();
  await page.waitForURL(/\/biz\/clients\/[^/?]+$/).catch(() => {});
  await page.waitForTimeout(1200);
  await page.goBack(); await page.waitForTimeout(2000);
  r.backUrl = page.url();
  r.backCounter = (await text()).match(/Найдено[^\n]*|\d+ клиент[^\n]*/)?.[0];
  r.firstAfterBack = (await page.locator('table tbody tr').first().innerText()).replace(/\s+/g, ' ').slice(0, 60);
  // ?pick=due прямой ссылкой
  await go('/biz/clients?pick=due');
  r.directPick = (await text()).match(/Найдено[^\n]*/)?.[0];
  // снять подборку
  await page.getByRole('button', { name: /Пора записать/ }).first().click(); await page.waitForTimeout(1500);
  r.urlAfterUnpick = page.url();
  // сортировка по имени в подборке, потом сброс
  await go('/biz/clients?pick=due');
  const nameTh = page.locator('table thead th').filter({ hasText: 'Имя' }).locator('button').first();
  await nameTh.click(); await page.waitForTimeout(1500);
  r.dueSortedByName = (await page.locator('table tbody tr td:nth-child(2)').allInnerTexts()).slice(0, 3).map((s) => s.replace(/\s+/g, ' '));
  // мастер — чужой клиент (созданный в s06, без визитов)
  await go('/biz/clients/cl_muofzex6h3rugw', { persona: 'master' });
  r.masterForeign = (await text()).slice(0, 300);
  await shot('s13-master-foreign');
  // правка без смены пола — в журнале не должно быть «Пол»
  await go('/biz/clients/cl_muofzex6h3rugw');
  await page.getByRole('button', { name: /^Изменить$/ }).first().click().catch(async () => {
    await page.getByRole('button', { name: /^Ещё$|Действия с клиентом/ }).first().click(); await page.getByRole('menuitem', { name: /Изменить/ }).click();
  });
  await page.waitForTimeout(1000);
  const dlg = page.locator('[role=dialog]').last();
  await dlg.getByLabel(/^Email/).first().fill('test-fix@example.com');
  await dlg.getByRole('button', { name: /^Сохранить$/ }).click(); await page.waitForTimeout(2000);
  await go('/biz/clients/log');
  r.log = (await text()).slice(0, 400);
  // автор импорта
  await go('/biz/clients/import');
  await page.getByPlaceholder(/Вставьте сюда данные/).first().fill(`Имя\tТелефон\nАвтор Проверка\t37433${String(Date.now()).slice(-6)}\n`);
  await page.getByRole('button', { name: /Загрузить из поля/ }).click(); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /^Загрузить$/ }).last().click(); await page.waitForTimeout(2500);
  r.importLog = (await text()).match(/\d+ сентября, [\d:]+ · [^\n]*/g)?.slice(0, 3);
  return r;
};
