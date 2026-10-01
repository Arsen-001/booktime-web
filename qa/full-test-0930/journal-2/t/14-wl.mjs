const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  await go(p, '/biz/journal'); await waitReady(p);
  await p.getByRole('button', { name: 'Ещё', exact: true }).first().click(); await p.waitForTimeout(800);
  await p.locator('[role=dialog]').last().getByText('Лист ожидания', { exact: true }).click(); await p.waitForTimeout(1500);
  await p.locator('[role=dialog]').last().getByRole('button', { name: '+ Создать' }).first().click(); await p.waitForTimeout(1200);
  const d = p.locator('[role=dialog]').last();
  o += 'FORM ' + (await d.innerText()).slice(0,1500) + '\n';
  o += 'INPUTS ' + await d.evaluate(d=>[...d.querySelectorAll('input,textarea,select,[role=combobox]')].map(i=>i.tagName+':'+(i.getAttribute('aria-label')||i.name||i.placeholder||i.id)+'='+(i.value||'')).join(' ; ')) + '\n';
  o += 'B ' + await btns(p) + '\n';
  await lib.shot(p, 'o14-wl-form');
  return o;
};
