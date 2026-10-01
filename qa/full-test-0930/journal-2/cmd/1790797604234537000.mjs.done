const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  await go(p, '/biz/journal?booking=bk_2381'); await waitReady(p); await p.waitForTimeout(1500);
  await p.locator('[role=dialog]').first().getByRole('button', { name: 'Дублировать' }).click(); await p.waitForTimeout(2000);
  o += 'DUP URL ' + p.url() + '\n';
  o += 'DUP ' + (await dlg(p)).slice(0,500).replace(/\n+/g,' / ') + '\n';
  o += 'TOAST ' + await toasts(p) + '\n';
  await lib.shot(p, 'o37-duplicate2');
  await p.keyboard.press('Escape'); await go(p, '/biz/journal'); await waitReady(p);
  o += 'Liana cards at grid: ' + await p.locator('[data-testid=booking-block]', { hasText: 'Лиана Г.' }).count() + '\n';
  const boxes = await p.locator('[data-testid=booking-block]', { hasText: 'Лиана Г.' }).evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width)].join(',')}));
  o += 'boxes ' + boxes.join(' ; ') + '\n';
  await lib.shot(p, 'o37-grid-after-dup');
  return o;
};
