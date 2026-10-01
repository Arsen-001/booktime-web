import { waitReady, dlg, btns, toasts } from '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs';
export default async ({ browser, lib, state }) => {
  if (state.owner) await state.owner.context().close();
  const p = await lib.openPage(browser, { persona: 'owner', device: 'desktop', route: '/biz/journal?booking=bk_2381' });
  state.owner = p; await waitReady(p); await p.waitForTimeout(1500);
  let o='';
  await p.getByRole('button', { name: 'Оплатить', exact: true }).first().click(); await p.waitForTimeout(1500);
  await p.getByText('Раздельная оплата', { exact: true }).click(); await p.waitForTimeout(1000);
  const last = p.locator('[role=dialog]').last();
  o += 'SPLIT ' + (await last.innerText()).slice(0,1200) + '\n';
  o += 'INPUTS ' + await last.evaluate(d=>[...d.querySelectorAll('input')].map(i=>(i.getAttribute('aria-label')||i.name||i.placeholder)+'='+i.value).join(' ; ')) + '\n';
  o += 'B ' + await btns(p) + '\n';
  await lib.shot(p, 'o5-split');
  return o;
};
