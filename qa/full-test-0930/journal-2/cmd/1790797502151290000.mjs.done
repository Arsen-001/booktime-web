const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const m = state.master; let o='';
  const d = await dlg(m); o += 'TAIL ' + d.slice(-900).replace(/\n+/g,' / ') + '\n';
  o += 'B ' + await btns(m) + '\n';
  o += 'priceInputs ' + await m.evaluate(()=>[...document.querySelectorAll('[role=dialog] input')].map(i=>(i.getAttribute('aria-label')||i.placeholder||'')+'='+i.value+(i.disabled||i.readOnly?'(ro)':'')).join(' ; ')) + '\n';
  await lib.shot(m, 'p3-master-other-window');
  return o;
};
