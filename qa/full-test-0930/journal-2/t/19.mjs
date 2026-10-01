const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  o += 'URL ' + p.url() + '\n';
  const w = p.locator('[role=dialog]', { hasText: 'Новая запись' }).last();
  o += 'INPUTS ' + await w.evaluate(d=>[...d.querySelectorAll('input')].map(i=>(i.getAttribute('aria-label')||i.placeholder||i.name)+'='+i.value).join(' ; ')) + '\n';
  const t = await w.innerText(); o += 'TAIL ' + t.slice(-700) + '\n';
  await lib.shot(p, 'o19-wl-window');
  return o;
};
