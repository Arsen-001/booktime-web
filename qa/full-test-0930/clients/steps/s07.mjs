import { rowHrefs } from '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/clients/steps/rowhref.mjs';
// Карточка созданного в s06 клиента: комментарий, правка (чёрный список, имя), видно у админа; мастер не видит
export default async ({ page, go, shot, text }) => {
  const fs = await import('node:fs');
  const s06 = JSON.parse(fs.readFileSync('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/clients/out/s06.json', 'utf8')).value;
  const r = { stamp: s06.stamp };
  await go(`/biz/clients?q=${s06.stamp}`);
  const href = (await rowHrefs(page, 1))[0];
  r.href = href;
  await go(href);
  r.card = (await text()).slice(0, 900);
  await shot('s07-card');
  // комментарий
  const ta = page.getByPlaceholder('Новый комментарий').first();
  r.hasComment = await ta.count();
  if (r.hasComment) {
    await ta.fill('Аллергия на акрил — проверка');
    await page.getByRole('button', { name: /^Добавить$/ }).first().click(); await page.waitForTimeout(1500);
    r.commentShown = (await text()).includes('Аллергия на акрил');
  }
  // правка
  await page.getByRole('button', { name: /^Изменить$/ }).first().click().catch(async () => {
    await page.getByRole('button', { name: /Ещё|Действия/ }).first().click(); await page.getByRole('menuitem', { name: /Изменить/ }).click();
  });
  await page.waitForTimeout(1000);
  const dlg = page.locator('[role=dialog]').last();
  r.editForm = (await dlg.innerText()).slice(0, 1500);
  const sw = dlg.getByRole('switch', { name: /записываться онлайн/ }).or(dlg.getByLabel(/записываться онлайн/)).first();
  r.hasBlockSwitch = await sw.count();
  if (r.hasBlockSwitch) { await sw.scrollIntoViewIfNeeded(); await sw.click(); }
  const nameInput = dlg.getByLabel(/^Имя/).first();
  await nameInput.fill(`Тест Изменён ${s06.stamp}`);
  await dlg.getByRole('button', { name: /^Сохранить$/ }).click(); await page.waitForTimeout(1200);
  r.confirmName = (await page.locator('[role=alertdialog], [role=dialog]').last().innerText().catch(() => '')).slice(0, 300);
  const confirmBtn = page.locator('[role=alertdialog] button, [role=dialog] button').filter({ hasText: /Изменить|Сохранить|Да/ }).last();
  if (/Изменить имя/.test(r.confirmName)) { await confirmBtn.click(); await page.waitForTimeout(1500); }
  r.afterEdit = (await text()).slice(0, 900);
  await shot('s07-after-edit');
  // у админа
  await go(href, { persona: 'admin' });
  r.admin = (await text()).slice(0, 700);
  await shot('s07-admin-card');
  // у мастера (прямой ссылкой — без визита не его клиент)
  await go(href, { persona: 'master' });
  r.master = (await text()).slice(0, 400);
  await shot('s07-master-card');
  // журнал изменений
  await go('/biz/clients/log');
  r.log = (await text()).slice(0, 900);
  return r;
};
