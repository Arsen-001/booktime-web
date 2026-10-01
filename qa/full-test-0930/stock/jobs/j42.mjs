const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  await t.go('master', '/biz/stock/operations/new/income');
  const q = p.getByPlaceholder('Название, артикул или штрихкод');
  await q.fill('Шампунь'); await p.waitForTimeout(1200); await q.press('Enter'); await p.waitForTimeout(800);
  await p.getByRole('button', { name: 'Сохранить' }).click(); await p.waitForTimeout(3000);
  log('master save income → URL', p.url(), 'toasts', await p.evaluate(() => [...document.querySelectorAll('[data-sonner-toast], [role=status]')].map(e=>e.innerText)));
  await t.shot('master-income-save');
  await t.go('master', '/biz/stock/settings');
  log('master settings buttons', await t.buttons());
  await t.go('master', '/biz/stock/goods/new');
  log('master goods/new:', norm(await t.text()).replace(/\n+/g,' | ').slice(0, 200));
};
