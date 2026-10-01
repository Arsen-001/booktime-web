const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  await p.getByRole('button', { name: 'Списать просроченное' }).click(); await p.waitForTimeout(1200);
  log('after expired on Расходники:', norm(await t.text()).replace(/\n+/g,' | ').split('Товары | Добавить из списка')[1]?.slice(0, 300));
  await t.shot('writeoff-expired');
  await t.go('owner', '/biz/stock/operations/new/write-off');
  await p.getByRole('combobox', { name: 'Склад' }).click(); await p.waitForTimeout(300);
  await p.getByRole('option', { name: 'Товары' }).click();
  await p.getByRole('combobox', { name: 'Причина списания' }).click(); await p.waitForTimeout(300);
  await p.getByRole('option', { name: 'Брак' }).click();
  const q = p.getByPlaceholder('Название, артикул или штрихкод');
  await q.fill('мятн'); await p.waitForTimeout(1200); await q.press('Enter'); await p.waitForTimeout(800);
  await p.getByLabel(/^Количество/).first().fill('50'); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Сохранить' }).click(); await p.waitForTimeout(1500);
  log('over-stock save:', p.url(), norm(await t.text()).match(/(недостат|не хватает|больше|остат)[^\n]{0,120}/gi)?.slice(0,3));
  await t.shot('writeoff-over');
  await p.getByLabel(/^Количество/).first().fill('1');
  await p.getByRole('button', { name: 'Сохранить' }).click();
  await p.waitForURL((u) => !u.pathname.endsWith('/new/write-off'), { timeout: 120000 }).catch(()=>log('no nav'));
  await t.settle(1000);
  log('writeoff doc', p.url());
  // Перемещение 3 шт Товары → Расходники
  await t.go('owner', '/biz/stock/operations/new/move');
  log('move form:', norm(await t.text()).replace(/\n+/g,' | ').slice(0, 500));
  log(await p.evaluate(() => [...document.querySelectorAll('main input, main [role=combobox]')].filter(e=>e.getClientRects().length).map(e => (e.labels?.[0]?.innerText||e.getAttribute('aria-label')||e.placeholder||'').trim()+'='+(e.value||e.innerText))));
};
