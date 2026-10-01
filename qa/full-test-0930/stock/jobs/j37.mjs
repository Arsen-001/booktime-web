const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/stock');
  const s = p.locator('main input[type=search]:visible').first();
  await s.fill('Шампунь'); await t.settle(1500);
  log('catalog shampoo:', norm(await t.text()).split('Цена')[1]?.replace(/\s+/g,' ').slice(0, 90));
  await s.fill('Крем для'); await t.settle(1500);
  log('catalog cream:', norm(await t.text()).split('Цена')[1]?.replace(/\s+/g,' ').slice(0, 90));
  await t.go('owner', '/biz/stock/operations');
  const txt = norm(await t.text());
  log('ops sale rows:', txt.match(/Продажа товара[^\n]*\n[^]*?Показать/g)?.map(x => x.replace(/\s+/g,' ').slice(0, 170)));
  await t.go('owner', '/biz/finance');
  const ft = norm(await t.text());
  log('finance goods sales:', ft.match(/[^\n]*\n?[^\n]*Продажа товаров[^]*?(6 500|9 800)[^\n]*/g)?.map(x=>x.replace(/\s+/g,' ').slice(-200)));
};
