const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  let o='';
  const a = await lib.openPage(browser, { persona: 'admin', device: 'phone' }); state.admin = a; await waitReady(a); await a.waitForTimeout(1500);
  await lib.shot(a, 'q1-admin-journal');
  // open arrived booking (Лиана Г. 10:00 Пришёл)
  await a.locator('[data-testid=booking-block]', { hasText: 'Лиана Г.' }).first().click(); await a.waitForTimeout(2500);
  o += 'URL ' + a.url() + '\n';
  await lib.shot(a, 'q2-admin-window');
  const d = await dlg(a); o += 'WIN ' + d.slice(0,300).replace(/\n+/g,' / ') + '\n';
  o += 'B ' + await btns(a) + '\n';
  const del = a.locator('[role=dialog]').getByRole('button', { name: 'Удалить', exact: true });
  o += 'delete count ' + await del.count() + (await del.count() ? ' disabled=' + await del.first().isDisabled() : '') + '\n';
  const ov = await a.evaluate(()=>document.documentElement.scrollWidth > innerWidth); o += 'hscroll ' + ov + '\n';
  return o;
};
