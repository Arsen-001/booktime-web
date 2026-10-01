export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/stock/operations/new/income');
  log((await t.text()).replace(/\n+/g,' | ').slice(0, 1500));
  log('BTN', await t.buttons());
  log(await p.evaluate(() => [...document.querySelectorAll('main input, main [role=combobox], main textarea')].filter(e=>e.getClientRects().length).map(e => e.tagName+'/'+(e.getAttribute('role')||e.type)+' '+(e.labels?.[0]?.innerText||e.getAttribute('aria-label')||e.placeholder||'').trim())));
  await t.shot('income-new', true);
};
