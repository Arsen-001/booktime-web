export default async (t, log) => {
  const p = t.page;
  await p.getByRole('tab', { name: 'Карта' }).click().catch(async () => p.getByText('Карта', { exact: true }).last().click());
  await p.getByRole('button', { name: /Оплачено 5 600/ }).click();
  await p.waitForURL((u) => !u.pathname.endsWith('/new/sale'), { timeout: 120000 }).catch(()=>log('no nav'));
  await t.settle(1500);
  log('URL', p.url(), (await t.text()).replace(/\n+/g,' | ').slice(0, 600));
  await t.shot('sale-doc');
  await t.go('owner', '/biz/stock');
  const s = p.locator('main input[type=search]:visible').first();
  await s.fill('мятн'); await t.settle(1500);
  log('catalog:', (await t.text()).split('Цена')[1]?.replace(/\s+/g,' ').slice(0, 80));
  await t.go('owner', '/biz/finance');
  const ft = await t.text(); const i = ft.indexOf('5 600');
  log('finance sale row:', i >= 0 ? ft.slice(Math.max(0,i-200), i+20).replace(/\s+/g,' ') : 'NOT FOUND');
  await t.go('owner', '/biz/stock/operations');
  log('ops journal:', (await t.text()).replace(/\n+/g,' | ').slice(0, 1500));
  await t.shot('operations-desktop');
};
