const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  await p.getByRole('button', { name: 'Открыть визит' }).first().click();
  await p.waitForURL(/journal/, { timeout: 180000 }).catch(()=>log('no nav'));
  await t.settle(3000);
  log('URL', p.url());
  const dlg = p.locator('[role=dialog]:visible').last();
  log('dialog count', await dlg.count());
  const txt = norm(await (await dlg.count() ? dlg : p.locator('main')).innerText());
  log('visit:', txt.replace(/\n+/g,' | ').slice(0, 1500));
  await t.shot('visit-from-ops');
};
