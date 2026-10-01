export default async (t, log) => {
  await t.go('owner', '/biz/stock');
  await t.page.waitForTimeout(1500);
  log((await t.text()).slice(0, 900));
  await t.shot('catalog-after-seedfix-desktop');
  await t.go('owner', '/biz/stock/order');
  log('ORDER', (await t.text()).slice(0, 1200));
  await t.shot('order-desktop');
};
