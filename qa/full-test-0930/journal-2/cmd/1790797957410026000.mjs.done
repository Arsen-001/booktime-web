const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  o += 'URL ' + p.url() + '\n';
  o += 'DIALOGS ' + await p.evaluate(()=>[...document.querySelectorAll('[role=dialog],[role=alertdialog]')].map(d=>d.getAttribute('role')+':'+d.innerText.slice(0,80).replace(/\n/g,' ')).join(' || ')) + '\n';
  await lib.shot(p, 'o40-state');
  return o;
};
