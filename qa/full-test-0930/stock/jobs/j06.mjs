export default async (t, log) => {
  const p = t.page;
  await p.waitForURL(/goods\/gd|goods\/[a-z0-9_]+$/, { timeout: 120000 }).catch(()=>{});
  log('URL', p.url());
  await t.settle(1000);
  log((await t.text()).slice(0, 1200));
  await t.shot('good-card', true);
  const goodUrl = p.url();
  await t.go('owner', '/biz/stock');
  const s = p.getByPlaceholder(/Название, штрихкод/).first();
  await s.fill('2542039189021'); await t.settle(1500);
  log('SEARCH barcode:', (await t.text()).split('Цена')[1]?.slice(0, 200));
  await s.fill('мятн'); await t.settle(1500);
  log('SEARCH name:', (await t.text()).split('Цена')[1]?.slice(0, 200));
  await s.fill('zzzqqq'); await t.settle(1500);
  log('SEARCH none:', (await t.text()).slice(-300));
  await t.shot('catalog-search-empty');
  log('GOODURL', goodUrl);
};
