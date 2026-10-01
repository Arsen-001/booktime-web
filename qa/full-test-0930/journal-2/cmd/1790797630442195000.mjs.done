const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  await go(p, '/biz/journal?booking=bk_2383'); await waitReady(p); await p.waitForTimeout(1500);
  const w = p.locator('[role=dialog]').first();
  o += 'WHO ' + (await w.innerText()).slice(0,120).replace(/\n+/g,' / ') + '\n';
  await w.getByText('Записывает другого посетителя').click(); await p.waitForTimeout(800);
  const t = await w.innerText(); const i = t.indexOf('Записывает другого'); o += 'VIS ' + t.slice(i, i+400).replace(/\n+/g,' / ') + '\n';
  o += 'INPUTS ' + await w.evaluate(d=>[...d.querySelectorAll('input')].map(i=>(i.getAttribute('aria-label')||i.placeholder||i.name)+'='+i.value).join(' ; ')) + '\n';
  await lib.shot(p, 'o38-visitor');
  return o;
};
