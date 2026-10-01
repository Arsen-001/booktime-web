const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  await go(p, '/biz/journal?booking=bk_2385'); await waitReady(p); await p.waitForTimeout(1500);
  await p.locator('[role=dialog]').first().getByRole('button', { name: 'Дублировать' }).click(); await p.waitForTimeout(2000);
  o += 'DUP URL ' + p.url() + '\n';
  o += 'DUP ' + (await dlg(p)).slice(0,500).replace(/\n+/g,' / ') + '\n';
  o += 'TOAST ' + await toasts(p) + '\n';
  await lib.shot(p, 'o36-duplicate');
  return o;
};
