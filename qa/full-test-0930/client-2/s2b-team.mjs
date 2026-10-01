// Команда: уволить → восстановить → удалить (F-14-116…118), права мастера в /biz/apps/team
import { start, newPage, go, shot, text } from './h.mjs';

const { browser, done } = await start();
const log = (...a) => console.log(...a);
const one = (s, n = 600) => (s ?? '').slice(0, n).replace(/\n+/g, ' | ');
const body = (p) => p.locator('body').innerText();
try {
  const { page, errors } = await newPage(browser, { device: 'phone' });
  await go(page, '/biz/apps/team', 'owner');
  await page.getByRole('button', { name: 'Добавить сотрудника' }).first().click();
  await page.waitForTimeout(600);
  let dlg = page.getByRole('dialog');
  await dlg.getByLabel('Имя').fill('Гаяне QA');
  await dlg.getByLabel('Телефон').fill('+37491112233');
  await dlg.getByRole('button', { name: 'Создать' }).click();
  await page.waitForTimeout(1500);
  const openRow = async () => {
    for (let i = 0; i < 4; i++) {
      if (await page.getByText('Гаяне QA').count()) break;
      const next = page.getByRole('button', { name: 'Следующая страница' });
      if (!(await next.count()) || (await next.isDisabled())) break;
      await next.click();
      await page.waitForTimeout(800);
    }
    log('new staff on page 1?', 'page text:', one(await text(page), 200));
    await page.getByText('Гаяне QA').first().click();
    await page.waitForTimeout(1000);
    return page.getByRole('dialog');
  };
  dlg = await openRow();
  await dlg.getByRole('button', { name: 'Уволить' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('dialog').last().getByRole('button', { name: 'Уволить' }).click();
  await page.waitForTimeout(1500);
  log('fired toast:', (await body(page)).includes('Уволен'));
  dlg = await openRow();
  log('CARD after fire:', one(await dlg.innerText(), 300));
  const rest = dlg.getByRole('button', { name: 'Восстановить' });
  if (await rest.count()) { await rest.click(); await page.waitForTimeout(1500); log('CARD after restore:', one(await dlg.innerText(), 300)); }
  await dlg.getByRole('button', { name: 'Удалить' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('dialog').last().getByRole('button', { name: 'Удалить' }).click();
  await page.waitForTimeout(1500);
  log('deleted, still in list:', (await text(page)).includes('Гаяне QA'));
  await go(page, '/biz/staff', 'owner');
  log('web staff has Гаяне QA after delete:', (await text(page)).includes('Гаяне QA'));
  // Мастер: может ли уволить владельца?
  await go(page, '/biz/apps/team', 'master');
  await page.getByText('Нарине Акопян').first().click();
  await page.waitForTimeout(1000);
  dlg = page.getByRole('dialog');
  log('MASTER sees owner card buttons:', one(await dlg.innerText(), 300));
  await shot(page, 't-master-owner-card');
  log('ERRORS:', errors.slice(0, 6));
} catch (e) {
  console.error('FAIL', e.message);
} finally {
  await done();
}
