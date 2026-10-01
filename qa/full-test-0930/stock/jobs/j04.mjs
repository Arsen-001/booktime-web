export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/stock/goods/new');
  // пустое сохранение — проверка ошибок
  await p.getByRole('button', { name: 'Сохранить' }).click();
  await p.waitForTimeout(600);
  log('EMPTY SAVE errors:', await p.evaluate(() => [...document.querySelectorAll('[role=alert], [id$=-error], .text-danger')].map(e=>e.innerText).filter(Boolean).slice(0,5)));
  await p.getByLabel('Название', { exact: false }).first().fill('QA Гель-лак Мятный');
  await p.getByRole('combobox').first().click();
  await p.waitForTimeout(400);
  await p.getByRole('option', { name: /Гель-лаки/ }).first().click().catch(async (e) => { log('cat option fail', e.message.slice(0,100)); await p.keyboard.press('Escape'); });
  await p.getByLabel(/^Бренд/).fill('QA-Brand');
  await p.getByLabel(/^Оттенок/).fill('мятный');
  await p.getByRole('button', { name: 'Сгенерировать' }).click();
  await p.waitForTimeout(300);
  const barcode = await p.locator('xpath=//button[@aria-label="Сканировать"]/preceding::input[1]').inputValue();
  log('barcode', barcode);
  await p.getByLabel('Цена продажи').fill('2800');
  await p.getByLabel('Критичный остаток').fill('3');
  await p.getByLabel('Желаемый остаток').fill('10');
  // срок годности — открыть второй DatePicker
  await p.locator('main button[aria-haspopup=dialog]').nth(1).click();
  await p.waitForTimeout(500);
  await t.shot('good-new-datepicker');
  const day = p.locator('[role=dialog] button, [role=grid] button').filter({ hasText: /^20$/ }).first();
  if (await day.count()) { await day.click(); } else log('no day 20 button');
  await p.waitForTimeout(300);
  await p.getByLabel('Показывать клиентам').check();
  await t.shot('good-new-filled', true);
  await p.getByRole('button', { name: 'Сохранить' }).click();
  await t.settle(1500);
  log('URL after save', p.url());
  log((await t.text()).slice(0, 1500));
  await t.shot('good-saved', true);
  // найти в каталоге по штрихкоду
  await t.go('owner', '/biz/stock');
  await p.getByPlaceholder(/Название, штрихкод/).fill(barcode);
  await t.settle(1200);
  log('SEARCH barcode:', (await t.text()).split('Название\tКатегория')[1]?.slice(0, 300));
  await p.getByPlaceholder(/Название, штрихкод/).fill('мятн');
  await t.settle(1200);
  log('SEARCH name:', (await t.text()).split('Название\tКатегория')[1]?.slice(0, 300));
  await p.getByPlaceholder(/Название, штрихкод/).fill('zzzqqq');
  await t.settle(1200);
  log('SEARCH none:', (await t.text()).slice(-400));
  await t.shot('catalog-search-empty');
};
