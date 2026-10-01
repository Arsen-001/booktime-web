const norm = (s) => s.replace(/[  ]/g, ' ');
const flat = async (t, n = 400) => norm(await t.text()).replace(/\n+/g,' | ').slice(0, n);
export default async (t, log) => {
  const p = t.page;
  for (const persona of ['owner-empty', 'individual-empty']) {
    for (const r of ['/biz/stock', '/biz/stock/operations', '/biz/stock/order', '/biz/stock/tech-cards', '/biz/stock/equipment', '/biz/stock/inventory', '/biz/stock/reminders']) {
      await t.go(persona, r, 'phone');
      log(persona, r, '→', await flat(t, 260));
      if (r === '/biz/stock') await t.shot(`empty-${persona}-catalog-phone`);
    }
  }
  t.api = 'error';
  for (const r of ['/biz/stock', '/biz/stock/operations', '/biz/stock/order']) {
    await t.go('owner', r, 'phone');
    log('api=error', r, '→', await flat(t, 250));
  }
  await t.shot('api-error-order-phone');
  t.api = 'normal';
  await t.go('owner', '/biz/stock', 'phone', ''); // сброс cookie api
};
