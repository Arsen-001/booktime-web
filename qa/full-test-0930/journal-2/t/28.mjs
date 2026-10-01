const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  await go(p, '/biz/journal/settings'); await waitReady(p);
  await p.getByText('Имя клиента', { exact: true }).first().click();
  await p.getByRole('button', { name: 'Сохранить', exact: true }).first().click(); await p.waitForTimeout(1500);
  await go(p, '/biz/journal'); await waitReady(p);
  o += 'CARD1 ' + (await p.locator('[data-testid=booking-block]').first().innerText()).replace(/\n/g,' / ') + '\n';
  return o;
};
