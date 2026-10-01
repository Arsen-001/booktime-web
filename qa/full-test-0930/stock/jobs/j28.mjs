const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/journal?booking=bk_4279');
  await p.waitForTimeout(2000);
  const dlg = p.locator('[role=dialog]:visible').last();
  const el = dlg.getByText('Не пришёл', { exact: true }).first();
  log('status el', await el.evaluate(e => e.closest('button,[role=radio],label')?.outerHTML.slice(0, 300)));
  await el.click(); await p.waitForTimeout(2500);
  await t.shot('visit-noshow');
  const top = p.locator('[role=dialog]:visible, [role=alertdialog]:visible').last();
  log('top dialog:', norm(await top.innerText()).replace(/\n+/g,' | ').slice(0, 300));
  log('db status', await p.evaluate(() => { const r = localStorage.getItem('bp-mock-db:core:bookings'); if (!r) return 'no key'; const b = JSON.parse(r).find?.(x=>x.id==='bk_4279') ?? JSON.parse(r)?.items?.find?.(x=>x.id==='bk_4279'); return b?.status ?? ('shape ' + r.slice(0,80)); }));
};
