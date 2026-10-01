const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  o += 'NOW ' + (await dlg(p)).slice(0,300) + '\n';
  await go(p, '/biz/journal'); await waitReady(p);
  await p.getByRole('button', { name: 'Ещё', exact: true }).first().click(); await p.waitForTimeout(800);
  await p.locator('[role=dialog]').last().getByText('Лист ожидания', { exact: true }).click(); await p.waitForTimeout(1500);
  let d = p.locator('[role=dialog]').last();
  o += 'SELECTS ' + await d.locator('select').count() + '\n'; await d.locator('select').first().selectOption({ label: 'Все' }).catch(e=>o+='selerr '+e.message.slice(0,100)+'\n'); await p.waitForTimeout(800);
  o += 'LIST ' + (await d.innerText()).slice(400,900) + '\n';
  await d.locator('button', { hasText: 'Ани Саргсян' }).first().click(); await p.waitForTimeout(1000);
  await d.getByRole('button', { name: 'Записать', exact: true }).click(); await p.waitForTimeout(2500);
  o += 'URL ' + p.url() + '\n';
  o += 'WIN ' + (await dlg(p)).slice(0,900) + '\n';
  await lib.shot(p, 'o17-wl-book');
  return o;
};
