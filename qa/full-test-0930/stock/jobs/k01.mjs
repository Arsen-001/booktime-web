const norm = (s) => s.replace(/[  ]/g, ' ');
const flat = async (t, n = 250) => norm(await t.text()).replace(/\n+/g,' | ').slice(0, n);
export default async (t, log) => {
  const p = t.page;
  // 3. мастер: формы без права
  for (const r of ['/biz/stock/operations/new/income', '/biz/stock/goods/new', '/biz/stock/settings', '/biz/stock/inventory/new', '/biz/stock/operations/new/move']) {
    await t.go('master', r);
    log('master', r, '→', await flat(t, 160));
  }
  await t.shot('k-master-noaccess');
  // 1. администратор: приход и новый товар доступны, настройки — нет
  for (const r of ['/biz/stock/operations/new/income', '/biz/stock/goods/new', '/biz/stock/settings', '/biz/stock/operations/new/sale']) {
    await t.go('admin', r);
    log('admin', r, '→', await flat(t, 120));
  }
  await t.go('admin', '/biz/stock/goods/new');
  await p.getByLabel('Название', { exact: false }).first().fill('QA Админ товар');
  await p.getByRole('button', { name: 'Сохранить' }).click();
  await p.waitForURL(/goods\/gd/, { timeout: 60000 }).catch(() => log('admin good: no nav'));
  log('admin good saved URL', p.url());
  await t.go('admin', '/biz/stock/operations/new/income');
  await p.getByRole('combobox', { name: 'Склад' }).click(); await p.waitForTimeout(300);
  await p.getByRole('option', { name: 'Товары' }).click();
  const q = p.getByPlaceholder('Название, артикул или штрихкод');
  await q.fill('QA Админ'); await p.waitForTimeout(1200); await q.press('Enter'); await p.waitForTimeout(800);
  await p.getByLabel(/^Количество/).first().fill('4');
  await p.getByRole('button', { name: 'Сохранить' }).click();
  await p.waitForURL((u) => !u.pathname.endsWith('/new/income'), { timeout: 60000 }).catch(() => log('admin income: no nav'));
  log('admin income URL', p.url());
  await t.go('admin', '/biz/stock');
  log('admin nav has Настройки склада:', await p.locator('nav a[href="/biz/stock/settings"]').count());
};
