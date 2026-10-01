const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  let o='';
  const p = await lib.openPage(browser, { persona: 'owner', device: 'desktop', route: '/biz/journal', extra: '' });
  try {
  await go(p, '/biz/journal?demo=owner&sphere=fitness&lang=ru'); await waitReady(p); await p.waitForTimeout(1500);
  await lib.shot(p, 'o47-fitness');
  // click empty cell: find grid column area and click at a y where no block
  const col = p.locator('[data-f*="F-01-215"]').first();
  const bb = await col.boundingBox(); o += 'grid box ' + JSON.stringify(bb) + '\n';
  await p.mouse.click(bb.x + bb.width*0.9, bb.y + bb.height*0.5); await p.waitForTimeout(1500);
  o += 'AFTER CLICK ' + (await dlg(p)).slice(0,400).replace(/\n+/g,' / ') + ' URL ' + p.url() + '\n';
  await lib.shot(p, 'o47-fitness-click');
  } catch (e) { o += 'ERR ' + e.message.slice(0,200); }
  await p.context().close();
  return o;
};
