const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  const w = p.locator('[role=dialog]', { hasText: 'Новая запись' }).last();
  await w.getByPlaceholder('91 234 567').fill('91234567'); await p.waitForTimeout(800);
  await w.getByPlaceholder('Имя').fill('Тест Ожидание').catch(()=>{});
  await w.getByRole('button', { name: 'Записать', exact: true }).last().click(); await p.waitForTimeout(2000);
  const ok = p.getByRole('button', { name: 'Всё равно сохранить' }); if (await ok.count()) { await ok.click(); await p.waitForTimeout(1500); }
  o += 'TOAST ' + await toasts(p) + '\n';
  const d = p.locator('[role=dialog]').last();
  o += 'PANEL ' + (await d.innerText()).slice(0,300) + '\n';
  await d.getByRole('button', { name: 'Закрытая' }).click().catch(e=>o+='noclosedbtn\n'); await p.waitForTimeout(1000);
  o += 'CLOSED ' + (await p.locator('[role=dialog]').last().innerText()).slice(300,1000) + '\nB ' + (await btns(p)).slice(0,400);
  await lib.shot(p, 'o23-wl-closed');
  return o;
};
