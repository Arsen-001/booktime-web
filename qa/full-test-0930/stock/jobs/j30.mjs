const norm = (s) => s.replace(/[  ]/g, ' ');
const flat = async (t, n = 700) => norm(await t.text()).replace(/\n+/g,' | ').slice(0, n);
export default async (t, log) => {
  const p = t.page;
  // Оборудование
  await t.go('owner', '/biz/stock/equipment');
  log('EQUIP:', await flat(t, 500));
  await t.go('owner', '/biz/stock/equipment/new');
  log('EQUIP NEW fields:', await p.evaluate(() => [...document.querySelectorAll('main input, main [role=combobox], main button[aria-haspopup=dialog]')].filter(e=>e.getClientRects().length).map(e => (e.labels?.[0]?.innerText||e.getAttribute('aria-label')||e.placeholder||e.innerText||'').trim())));
  await p.getByRole('button', { name: 'Сохранить' }).click(); await p.waitForTimeout(600);
  log('empty save errs:', norm(await t.text()).match(/Введите[^\n]*/g));
  await p.locator('main input').first().fill('QA Лампа UV');
  await p.getByRole('button', { name: 'Сохранить' }).click();
  await p.waitForURL((u) => !u.pathname.endsWith('/new'), { timeout: 120000 }).catch(()=>log('no nav'));
  await t.settle(1000);
  log('after save URL', p.url());
  await t.go('owner', '/biz/stock/equipment');
  log('EQUIP list has QA:', norm(await t.text()).includes('QA Лампа UV'));
  await t.shot('equipment-list');
  // Напоминания
  await t.go('owner', '/biz/stock/reminders');
  log('REMINDERS:', await flat(t, 1200));
  await t.shot('reminders');
  // Инвентаризация
  await t.go('owner', '/biz/stock/inventory/new');
  log('INV NEW:', await flat(t, 600));
  log('BTN', await t.buttons());
};
