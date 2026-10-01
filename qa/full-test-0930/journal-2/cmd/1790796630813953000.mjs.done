import { waitReady, dlg, btns, toasts } from '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs';
export default async ({ browser, lib, state }) => {
  const p = state.owner;
  let o='';
  await p.getByRole('button', { name: /Наличные/ }).last().click(); await p.waitForTimeout(1800);
  await lib.shot(p, 'o3-paid');
  o += 'TOAST ' + await toasts(p) + '\n';
  const d = await dlg(p); o += 'DLG ' + d.split('-----').pop().slice(0,1500) + '\n';
  o += 'PAYZONE ' + (d.match(/К оплате[\s\S]{0,200}/)||[''])[0] + '\n';
  o += 'DBTNS ' + await btns(p) + '\n';
  return o;
};
