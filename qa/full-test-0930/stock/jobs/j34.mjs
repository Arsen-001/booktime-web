const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/stock/inventory/new');
  await p.getByRole('combobox', { name: 'Склад' }).click(); await p.waitForTimeout(300);
  await p.getByRole('option', { name: 'Товары' }).click();
  await p.getByRole('button', { name: 'Начать инвентаризацию' }).click();
  await p.waitForURL((u) => !u.pathname.endsWith('/new'), { timeout: 120000 }).catch(()=>log('no nav'));
  await t.settle(1500);
  log('URL', p.url());
  log('INV:', norm(await t.text()).replace(/\n+/g,' | ').slice(0, 1500));
  log('BTN', await t.buttons());
  log('inputs', await p.evaluate(() => [...document.querySelectorAll('main input')].filter(e=>e.getClientRects().length).map(e => (e.labels?.[0]?.innerText||e.getAttribute('aria-label')||e.placeholder||'').trim()+'='+e.value)));
  await t.shot('inventory-detail', true);
};
