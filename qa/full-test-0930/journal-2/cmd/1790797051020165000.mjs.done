const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  // «Ещё» menu of the card: edit/delete
  const d = p.locator('[role=dialog]').last();
  await d.getByRole('button', { name: 'Ещё', exact: true }).click(); await p.waitForTimeout(600);
  o += 'MENU ' + await p.evaluate(()=>[...document.querySelectorAll('[role=menuitem]')].map(m=>m.innerText).join(' | ')) + '\n';
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await d.getByRole('button', { name: 'Записать', exact: true }).click(); await p.waitForTimeout(2500);
  o += 'URL ' + p.url() + '\n';
  const w = await dlg(p); o += 'WIN ' + w.slice(0,900) + '\n';
  await lib.shot(p, 'o17-wl-book');
  return o;
};
