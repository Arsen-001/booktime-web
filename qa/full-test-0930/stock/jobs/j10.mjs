export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/stock/operations/new/income');
  await p.getByRole('combobox', { name: 'Склад' }).click(); await p.waitForTimeout(300);
  await p.getByRole('option', { name: 'Товары' }).click();
  const q = p.getByPlaceholder('Название, артикул или штрихкод');
  await q.fill('мятн'); await p.waitForTimeout(1200);
  await q.press('Enter'); await p.waitForTimeout(1000);
  let txt = (await t.text());
  log('Enter added line?', txt.includes('Товары ещё не добавлены') ? 'NO' : 'YES');
  if (txt.includes('Товары ещё не добавлены')) { await q.fill('мятн'); await p.waitForTimeout(1200); await p.locator('main button').filter({ hasText: 'QA Гель-лак Мятный' }).first().click(); await p.waitForTimeout(800); }
  log(await p.evaluate(() => [...document.querySelectorAll('main input')].filter(e=>e.getClientRects().length).map(e => (e.labels?.[0]?.innerText||e.getAttribute('aria-label')||e.placeholder||'').trim()+'='+e.value)));
  await t.shot('income-line', true);
};
