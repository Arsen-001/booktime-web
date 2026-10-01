const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const m = state.master; let o='';
  try {
  await go(m, '/biz/journal?demo=master&sphere=nails&lang=ru'); await waitReady(m); await m.waitForTimeout(1200);
  await m.getByRole('button', { name: 'Ещё', exact: true }).last().click(); await m.waitForTimeout(1000);
  o += 'MORE ' + (await m.locator('[role=dialog]').last().innerText()).slice(0,900).replace(/\n+/g,' / ') + '\n';
  await lib.shot(m, 'p7-master-more');
  await m.keyboard.press('Escape'); await m.waitForTimeout(500);
  await m.getByRole('button', { name: 'Открыть календарь месяца' }).click(); await m.waitForTimeout(1200);
  o += 'MONTH ' + (await m.locator('[role=dialog]').last().innerText()).slice(0,500).replace(/\n+/g,' / ') + '\n';
  await lib.shot(m, 'p8-master-month');
  await m.keyboard.press('Escape'); await m.waitForTimeout(500);
  // tap on a booking (own)
  await m.locator('[data-testid=booking-block]').first().click(); await m.waitForTimeout(2500);
  await lib.shot(m, 'p9-master-own-window');
  const d = await dlg(m); o += 'OWNWIN phone? ' + (d.match(/\+374[^\n]*/)||['none'])[0] + ' | delete? ' + d.includes('Удалить') + '\n';
  o += 'B ' + (await btns(m)).slice(0,500) + '\n';
  } catch (e) { o += 'ERR ' + e.message.slice(0,200); await lib.shot(m,'p-err'); }
  return o;
};
