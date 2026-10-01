const norm = (s) => s.replace(/[  ]/g, ' ');
const count = async (t) => norm(await t.text()).match(/Найдено документов\s*\|?\s*(\d+)/)?.[1] ?? norm(await t.text()).match(/Найдено документов\n+(\d+)/)?.[1];
export default async (t, log) => {
  const p = t.page;
  const dlg = p.locator('[role=dialog]:visible').last();
  await dlg.getByRole('radio', { name: 'Не пришёл' }).click().catch(async () => dlg.getByText('Не пришёл', { exact: true }).first().click());
  await p.waitForTimeout(2500);
  const c2 = p.locator('[role=dialog]:visible, [role=alertdialog]:visible').last();
  log('after no-show dialog:', norm(await c2.innerText()).replace(/\n+/g,' | ').slice(0, 300));
  const confirmBtn = c2.getByRole('button', { name: /Да|Подтвердить|Не пришёл/ });
  if (await c2.getByText(/уверены|Отметить/).count()) await confirmBtn.last().click().catch(()=>{});
  await p.waitForTimeout(2000);
  log('consumables block now:', norm(await p.locator('[role=dialog]:visible').last().innerText()).match(/Списание расходников[^\n]*\n[^\n]*\n[^\n]*/)?.[0]);
  await t.go('owner', '/biz/stock/operations');
  log('ops count after no-show:', await count(t), norm(await t.text()).includes('18:00\t100075') );
  log('first row:', norm(await t.text()).split('История изменений')[1]?.replace(/\s+/g,' ').slice(0, 200));
};
