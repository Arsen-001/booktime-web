const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/stock/operations');
  const link = p.getByRole('link', { name: 'Открыть визит' }).first();
  const href = await link.getAttribute('href').catch(()=>null);
  log('visit href', href);
  const btn = href ? link : p.getByRole('button', { name: 'Открыть визит' }).first();
  await btn.click(); await p.waitForTimeout(3000); await t.settle(1500);
  log('URL', p.url());
  const dlg = p.locator('[role=dialog]:visible').last();
  const txt = norm(await (await dlg.count() ? dlg : p.locator('main')).innerText());
  log('visit:', txt.replace(/\n+/g,' | ').slice(0, 1500));
  await t.shot('visit-from-ops');
};
