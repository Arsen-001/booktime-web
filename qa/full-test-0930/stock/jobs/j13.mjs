export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/stock/operations/new/sale');
  log((await t.text()).replace(/\n+/g,' | ').slice(0, 1200));
  log('BTN', await t.buttons());
  log(await p.evaluate(() => [...document.querySelectorAll('main input, main [role=combobox]')].filter(e=>e.getClientRects().length).map(e => e.tagName+'/'+(e.getAttribute('role')||e.type)+' '+(e.labels?.[0]?.innerText||e.getAttribute('aria-label')||e.placeholder||'').trim())));
  await t.shot('sale-new', true);
};
