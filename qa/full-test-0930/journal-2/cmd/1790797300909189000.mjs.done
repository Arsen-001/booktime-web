const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  const w = p.locator('[role=dialog]', { hasText: 'Новая запись' }).last();
  const st = w.getByLabel('Начало'); o += 'tag ' + await st.evaluate(e=>e.tagName+' '+e.getAttribute('role')) + '\n';
  if (await st.evaluate(e=>e.tagName)==='SELECT') await st.selectOption('14:00'); else { await st.click(); await p.waitForTimeout(400); await p.getByRole('option', { name: '14:00' }).first().click(); }
  await p.waitForTimeout(500);
  // add service
  await w.getByRole('button', { name: /Маникюр классический/ }).first().click(); await p.waitForTimeout(600);
  await w.getByRole('button', { name: 'Записать без клиента' }).click(); await p.waitForTimeout(1000);
  await p.getByRole('button', { name: 'Всё равно сохранить' }).click(); await p.waitForTimeout(2000);
  o += 'TOAST ' + await toasts(p) + '\n';
  const d = p.locator('[role=dialog]').last();
  o += 'PANEL ' + (await d.innerText()).slice(0,400) + '\n';
  await d.getByRole('button', { name: 'Закрытая' }).click().catch(e=>o+='noclosedbtn\n'); await p.waitForTimeout(1000);
  o += 'CLOSED ' + (await p.locator('[role=dialog]').last().innerText()).slice(300,1000) + '\n';
  await lib.shot(p, 'o21-wl-closed');
  return o;
};
