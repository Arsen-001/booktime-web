export default async (t, log) => {
  const p = t.page;
  log('supplier value', await p.getByLabel(/^Поставщик/).inputValue().catch(e=>e.message.slice(0,80)));
  await t.go('owner', '/biz/stock');
  const s = p.locator('main input[type=search]:visible').first();
  await s.fill('мятн'); await t.settle(1500);
  log('catalog:', (await t.text()).split('Цена')[1]?.replace(/\s+/g,' ').slice(0, 120));
  await p.getByText('QA Гель-лак Мятный').first().click();
  await p.waitForURL(/goods\//, { timeout: 120000 }); await t.settle(1500);
  log('cost in card', await p.getByLabel('Себестоимость').inputValue());
  log('levels', (await t.text()).match(/Остат[^\n]*\n[^\n]*\n[^\n]*/g)?.slice(0,4));
  await t.go('owner', '/biz/finance');
  const ft = (await t.text());
  log('finance has 16 800:', ft.includes('16 800'), ft.replace(/\n+/g,' | ').slice(0, 800));
  await t.shot('finance-after-income');
};
