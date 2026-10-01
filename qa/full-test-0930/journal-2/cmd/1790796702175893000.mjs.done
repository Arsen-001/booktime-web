import { waitReady, dlg, btns, toasts } from '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs';
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  const last = p.locator('[role=dialog]').last();
  const ins = last.locator('input');
  await ins.nth(0).fill('5000'); await ins.nth(1).fill('4500'); await p.waitForTimeout(400);
  o += 'BEFORE ' + (await last.innerText()).slice(0,400) + '\n';
  await last.getByRole('button', { name: /Оплатить/ }).click(); await p.waitForTimeout(1500);
  o += 'TOAST ' + await toasts(p) + '\n';
  o += 'AFTER ' + (await p.locator('[role=dialog]').last().innerText()).slice(0,600) + '\n';
  await lib.shot(p, 'o6-split-paid');
  return o;
};
