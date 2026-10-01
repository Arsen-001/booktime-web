const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  const d = p.locator('[role=dialog]').last();
  await d.locator('input').nth(0).fill('Тест Ожидание');
  await d.locator('input').nth(1).fill('91234567');
  await d.getByRole('button', { name: 'Маникюр классический' }).click();
  await d.getByRole('button', { name: 'Ани Саргсян' }).click();
  await d.getByRole('button', { name: 'Выберите дату' }).click(); await p.waitForTimeout(700);
  o += 'CAL ' + (await p.locator('[role=dialog],[role=grid],[data-radix-popper-content-wrapper]').last().innerText()).slice(0,300) + '\n';
  // pick day 2 (Oct 2) if exists
  const day = p.getByRole('gridcell', { name: /^2$/ }).or(p.getByRole('button', { name: /2 октября|^2$/ }));
  o += 'daycnt ' + await day.count() + '\n';
  if (await day.count()) { await day.first().click(); await p.waitForTimeout(500); }
  await lib.shot(p, 'o15-wl-filled');
  await d.getByRole('button', { name: 'Создать заявку' }).click(); await p.waitForTimeout(1500);
  o += 'TOAST ' + await toasts(p) + '\n';
  o += 'AFTER ' + (await p.locator('[role=dialog]').last().innerText()).slice(0,1200) + '\n';
  await lib.shot(p, 'o15-wl-created');
  return o;
};
