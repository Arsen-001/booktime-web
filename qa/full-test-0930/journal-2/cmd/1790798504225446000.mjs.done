const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const m = state.master; let o='';
  try {
  await go(m, '/biz/journal?demo=master&sphere=nails&lang=ru'); await waitReady(m); await m.waitForTimeout(1500);
  await m.locator('[data-testid=booking-block]', { hasText: 'Диана' }).first().click(); await m.waitForTimeout(4000);
  o += 'URL ' + m.url() + '\n';
  await lib.shot(m, 'p10-master-own-window');
  const d = await dlg(m); o += 'WIN ' + d.slice(0,200).replace(/\n+/g,' / ') + '\nphone ' + (d.match(/\+374[^\n]*/)||['none'])[0] + ' | delete btn ' + await m.locator('[role=dialog]').getByRole('button', { name: 'Удалить' }).count() + '\n';
  const pr = await m.evaluate(()=>[...document.querySelectorAll('[role=dialog] input')].map(i=>i.value+(i.disabled||i.readOnly?'(ro)':'')).join(',')); o += 'inputs ' + pr + '\n';
  } catch (e) { o += 'ERR ' + e.message.slice(0,200); }
  return o;
};
