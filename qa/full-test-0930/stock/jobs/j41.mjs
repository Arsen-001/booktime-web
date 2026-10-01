const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  for (const persona of ['master', 'admin']) {
    await t.go(persona, '/biz/stock', 'phone');
    log(persona, 'catalog:', norm(await t.text()).replace(/\n+/g,' | ').slice(0, 260));
    log(persona, 'buttons:', (await t.buttons()).slice(0, 8));
    await t.shot(`${persona}-catalog-phone`);
    await t.go(persona, '/biz/stock/operations/new/income', 'phone');
    log(persona, 'income:', norm(await t.text()).replace(/\n+/g,' | ').slice(0, 160));
    await t.go(persona, '/biz/stock/settings', 'phone');
    log(persona, 'settings:', norm(await t.text()).replace(/\n+/g,' | ').slice(0, 160));
  }
  for (const r of ['/biz/stock/order', '/biz/stock/operations', '/biz/stock/reminders', '/biz/stock/equipment']) {
    await t.go('owner', r, 'phone');
    await t.shot(`owner${r.replace(/\//g,'_')}-phone`);
    log('overflow', r, await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  }
  // клиент: палитра со склада (F-00-143/144)
  await t.go('client', '/', 'phone');
  log('client home ok', (await t.text()).slice(0, 80).replace(/\n/g,' '));
};
