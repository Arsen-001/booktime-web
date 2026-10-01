const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  const d = p.locator('[role=dialog]').last();
  const item = d.locator('button,li,[role=button]', { hasText: 'Ани Саргсян' }).first();
  await item.click(); await p.waitForTimeout(1200);
  o += 'CARD ' + (await p.locator('[role=dialog]').last().innerText()).slice(0,1200) + '\nB ' + await btns(p) + '\n';
  await lib.shot(p, 'o16-wl-card');
  return o;
};
