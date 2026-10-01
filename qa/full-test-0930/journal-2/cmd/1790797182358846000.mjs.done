const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  const w = p.locator('[role=dialog]', { hasText: 'Новая запись' }).last();
  const txt = await w.innerText(); o += 'CLIENT? ' + (txt.match(/Тест Ожидание|91 234 567/g)||[]).join(',') + ' SERVICE? ' + txt.includes('Маникюр классический') + '\n';
  o += 'FOOTER ' + (await w.evaluate(d=>[...d.querySelectorAll('button')].slice(-4).map(b=>b.innerText).join(' | '))) + '\n';
  await w.getByRole('button', { name: /^Записать/ }).last().click(); await p.waitForTimeout(2500);
  o += 'TOAST ' + await toasts(p) + '\n';
  o += 'DLG ' + (await dlg(p)).slice(0,1200) + '\n';
  await lib.shot(p, 'o18-wl-booked');
  return o;
};
