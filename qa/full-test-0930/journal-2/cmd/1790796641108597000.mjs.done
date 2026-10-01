import { waitReady, dlg, btns, toasts } from '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs';
export default async ({ browser, lib, state }) => {
  const p = state.owner;
  let o='';
  await p.getByRole('button', { name: 'Отменить платёж' }).click(); await p.waitForTimeout(1200);
  o += 'AFTER1 ' + (await dlg(p)).split('-----').pop().slice(0,600) + '\n' + 'B ' + await btns(p) + '\n';
  const conf = p.getByRole('alertdialog'); if (await conf.count()) { o += 'CONFIRM ' + (await conf.innerText()).slice(0,300) + '\n'; await conf.getByRole('button').last().click(); await p.waitForTimeout(1500); }
  o += 'TOAST ' + await toasts(p) + '\n';
  const d = await dlg(p); o += 'DLG ' + d.split('-----').pop().slice(0,800) + '\n';
  await lib.shot(p, 'o4-cancelled');
  return o;
};
