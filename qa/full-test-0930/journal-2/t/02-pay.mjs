import { waitReady, dlg, btns, toasts } from '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs';
export default async ({ browser, lib, state }) => {
  const p = state.owner;
  let o='';
  await p.getByRole('button', { name: 'Оплатить', exact: true }).first().click(); await p.waitForTimeout(1500);
  await lib.shot(p, 'o2-pay');
  o += 'DLG ' + (await dlg(p)).slice(-2500) + '\n';
  o += 'DBTNS ' + await btns(p) + '\n';
  return o;
};
