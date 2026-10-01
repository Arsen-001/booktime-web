const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const a = state.admin; let o='';
  await a.locator('[role=dialog]').getByRole('tab', { name: 'Оплата' }).click().catch(async()=>{ await a.locator('[role=dialog]').getByText('Оплата', { exact: true }).first().click(); });
  await a.waitForTimeout(1200);
  await lib.shot(a, 'q3-admin-pay-tab');
  const d = await dlg(a); const i = d.indexOf('К оплате'); o += 'PAY ' + d.slice(i, i+300).replace(/\n+/g,' / ') + '\n';
  const pay = a.locator('[role=dialog]').getByRole('button', { name: 'Оплатить', exact: true });
  o += 'pay btn ' + await pay.count() + (await pay.count()? ' disabled=' + await pay.first().isDisabled():'') + '\n';
  if (await pay.count() && !(await pay.first().isDisabled())) { await pay.first().click(); await a.waitForTimeout(1500); await lib.shot(a, 'q4-admin-paysheet'); o += 'SHEET ' + (await a.locator('[role=dialog]').last().innerText()).slice(0,400).replace(/\n+/g,' / ') + '\n'; await a.keyboard.press('Escape'); }
  return o;
};
