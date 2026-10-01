const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  const d = p.locator('[role=dialog]').last();
  o += 'FULL ' + (await d.innerText()).slice(-500) + '\n';
  await d.getByRole('button', { name: 'Ещё', exact: true }).last().click(); await p.waitForTimeout(600);
  o += 'MENU ' + await p.evaluate(()=>[...document.querySelectorAll('[role=menuitem]')].map(m=>m.innerText).join(' | ')) + '\n';
  await lib.shot(p, 'o25-wl-menu');
  return o;
};
