const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  try {
  await go(p, '/biz?demo=owner&sphere=nails&lang=ru'); await waitReady(p); o += '/biz -> ' + new URL(p.url()).pathname + '\n';
  await go(p, '/biz/journal?demo=owner&sphere=nails&lang=ru'); await waitReady(p); await p.waitForTimeout(1000);
  // Ева Карапетян column (0 записей) - likely non-working
  const head = p.getByRole('button', { name: /Ева Карапетян/ }).first(); const hb = await head.boundingBox();
  await p.mouse.click(hb.x + hb.width/2, hb.y + 200); await p.waitForTimeout(1500);
  o += 'EVA click ' + (await dlg(p)).slice(0,300).replace(/\n+/g,' / ') + ' URL ' + p.url() + '\n';
  await lib.shot(p, 'o48-eva-click');
  } catch (e) { o += 'ERR ' + e.message.slice(0,200); }
  return o;
};
