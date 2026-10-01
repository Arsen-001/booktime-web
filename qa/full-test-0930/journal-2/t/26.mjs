const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  await go(p, '/biz/journal/settings'); await waitReady(p);
  o += 'TEXT ' + (await lib.text(p)).slice(0,5000) + '\n';
  o += 'FIDS ' + (await lib.fids(p)).join(' ') + '\n';
  await p.screenshot({ path: lib.OUT + '/o26-settings-full.png', fullPage: true });
  return o;
};
