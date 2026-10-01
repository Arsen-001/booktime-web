export default async (t, log) => {
  log(t.page.url());
  const ks = await t.page.evaluate(() => Object.keys(localStorage).map(k => k + ':' + (localStorage.getItem(k)||'').length));
  log(ks);
  log((await t.text()).slice(0,300));
};
