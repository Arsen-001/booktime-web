const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  let o='';
  const ctxPage = async (url) => { const p = await lib.openPage(browser, { persona: 'owner', device: 'desktop', route: url }); return p; };
  const p = await ctxPage('/biz/journal'); 
  try {
  await go(p, '/biz/journal?demo=owner&sphere=dental&lang=ru'); await waitReady(p); await p.waitForTimeout(1500);
  await p.locator('[data-testid=booking-block]').first().click(); await p.waitForTimeout(2500);
  const d = await dlg(p); o += 'DENTAL tabs ' + d.slice(0,250).replace(/\n+/g,' / ') + '\n';
  o += 'has Медкарта ' + d.includes('Медкарта') + ' План лечения ' + d.includes('План лечения') + ' Текущий приём ' + d.includes('Текущий при') + '\n';
  o += 'fids ' + (await lib.fids(p)).filter(f=>/F-01-1(89|90|91)/.test(f)).join(' ') + '\n';
  await lib.shot(p, 'o46-dental');
  const mk = p.getByText('Медкарта', { exact: true }).first(); if (await mk.count()) { await mk.click(); await p.waitForTimeout(1000); o += 'MED ' + (await p.locator('[role=dialog]').last().innerText()).slice(0,600).replace(/\n+/g,' / ') + '\n'; await lib.shot(p,'o46-medcard'); }
  } catch (e) { o += 'ERR ' + e.message.slice(0,200); }
  await p.context().close();
  return o;
};
