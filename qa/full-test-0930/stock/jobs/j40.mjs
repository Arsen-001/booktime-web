const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  for (const persona of ['owner', 'individual']) {
    for (const r of ['/biz/stock', '/biz/stock/operations', '/biz/stock/order', '/biz/stock/tech-cards', '/biz/stock/equipment', '/biz/stock/inventory', '/biz/stock/reminders', '/biz/stock/warehouses', '/biz/stock/reports', '/biz/stock/price-tags', '/biz/stock/archive']) {
      await t.go(persona, r, 'phone', '&empty=1');
      log(persona + '-empty', r, '→', norm(await t.text()).replace(/\n+/g,' | ').slice(0, 220));
      if (r === '/biz/stock' || r === '/biz/stock/reports') await t.shot(`empty-${persona}${r.replace(/\//g,'_')}-phone`);
    }
  }
  await t.go('owner', '/biz/stock', 'phone', '&empty=0');
};
