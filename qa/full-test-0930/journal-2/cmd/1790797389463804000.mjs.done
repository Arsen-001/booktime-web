const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  await p.getByRole('button', { name: 'Да', exact: true }).click(); await p.waitForTimeout(2500);
  o += 'TOAST ' + await toasts(p) + '\n';
  const d = p.locator('[role=dialog]').last();
  o += 'PANEL ' + (await d.innerText()).slice(0,300) + '\n';
  await d.getByRole('button', { name: 'Закрытая' }).click().catch(e=>o+='noclosedbtn\n'); await p.waitForTimeout(1000);
  o += 'CLOSED ' + (await p.locator('[role=dialog]').last().innerText()).slice(300,1000) + '\nB ' + (await btns(p)).slice(0,400);
  await lib.shot(p, 'o24-wl-closed');
  return o;
};
