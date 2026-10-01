export default async (t, log) => {
  const p = t.page;
  await p.getByLabel('Количество, шт.').fill('12');
  await p.getByLabel('Цена поставки').fill('1400');
  await p.getByLabel(/^Поставщик/).fill('QA Поставщик'); await p.waitForTimeout(800);
  await t.shot('income-supplier');
  const add = p.getByRole('option').first();
  log('supplier options', await p.getByRole('option').allInnerTexts());
  if (await add.count()) await add.click();
  await p.waitForTimeout(400);
  log('total text', (await t.text()).match(/Итого[^\n]*\n?[^\n]*/g));
  await p.getByRole('button', { name: 'Сохранить' }).click();
  await p.waitForURL((u) => !u.pathname.endsWith('/new/income'), { timeout: 120000 }).catch(()=>log('no nav'));
  await t.settle(1500);
  log('URL', p.url());
  log((await t.text()).replace(/\n+/g,' | ').slice(0, 1400));
  await t.shot('income-doc', true);
};
