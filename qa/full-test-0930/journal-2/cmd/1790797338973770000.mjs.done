const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  await lib.shot(p, 'o22-state');
  o += 'DIALOGS ' + await p.evaluate(()=>[...document.querySelectorAll('[role=dialog],[role=alertdialog]')].map(d=>d.getAttribute('role')+':'+d.innerText.slice(0,60).replace(/\n/g,' ')).join(' || ')) + '\n';
  o += 'ALLBTN ' + await p.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/Записать|Сохранить/.test(b.innerText)).map(b=>b.innerText+(b.disabled?'(dis)':'')).join(' | ')) + '\n';
  return o;
};
