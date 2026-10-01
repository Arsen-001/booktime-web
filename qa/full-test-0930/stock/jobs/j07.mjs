export default async (t, log) => {
  const p = t.page;
  const s = p.locator('main input[type=search]:visible').first();
  const rows = async () => (await t.text()).split('Цена')[1]?.replace(/\s+/g,' ').slice(0, 160);
  await s.fill('2542039189021'); await t.settle(1500); log('SEARCH barcode:', await rows());
  await s.fill('мятн'); await t.settle(1500); log('SEARCH name:', await rows());
  await s.fill('SKU-01'); await t.settle(1500); log('SEARCH sku:', await rows());
  await s.fill('zzzqqq'); await t.settle(1500); log('SEARCH none:', (await t.text()).replace(/\s+/g,' ').slice(-250));
  await t.shot('catalog-search-empty');
  await s.fill('мятн'); await t.settle(1200);
  await p.getByText('QA Гель-лак Мятный').first().click();
  await p.waitForURL(/goods\//, { timeout: 120000 }); await t.settle(1500);
  log('CARD URL', p.url());
  log((await t.text()).replace(/\n+/g,' | ').slice(0, 1500));
  log('BTN', await t.buttons());
  await t.shot('good-card', true);
};
