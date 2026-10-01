const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const m = state.master; let o='';
  await go(m, '/biz/journal'); await waitReady(m); await m.waitForTimeout(1000);
  o += 'TOPBTNS ' + await btns(m, 'body') + '\n';
  const s = m.getByRole('button', { name: /Найти клиента|Клиенты и чат|Поиск/ }).first();
  await s.click(); await m.waitForTimeout(1200);
  const inp = m.locator('[role=dialog] input').first(); await inp.fill('Мане'); await m.waitForTimeout(2000);
  const d = await dlg(m); o += 'SEARCH ' + d.slice(0,1500).replace(/\n+/g,' / ') + '\n';
  await lib.shot(m, 'p4-master-search');
  return o;
};
