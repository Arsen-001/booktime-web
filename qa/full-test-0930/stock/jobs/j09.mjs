export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/stock/operations/new/income');
  await p.getByRole('combobox', { name: 'Склад' }).click(); await p.waitForTimeout(300);
  await p.getByRole('option', { name: 'Товары' }).click();
  const q = p.getByPlaceholder('Название, артикул или штрихкод');
  await q.fill('мятн'); await p.waitForTimeout(1500);
  await t.shot('income-search');
  const opt = p.getByRole('option').filter({ hasText: 'Мятный' }).first();
  if (await opt.count()) await opt.click(); else { log('no option; trying Enter'); await q.press('Enter'); }
  await t.settle(800);
  log((await t.text()).replace(/\n+/g,' | ').slice(0, 1200));
  log(await p.evaluate(() => [...document.querySelectorAll('main input')].filter(e=>e.getClientRects().length).map(e => (e.labels?.[0]?.innerText||e.getAttribute('aria-label')||e.placeholder||'').trim()+'='+e.value)));
  await t.shot('income-line', true);
};
