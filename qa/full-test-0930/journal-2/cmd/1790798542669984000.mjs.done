const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  try {
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  const before = (await lib.text(p)).match(/Показано\s+(\d+)/)?.[1]; o += 'before ' + before + '\n';
  await p.getByRole('button', { name: 'Операции с Excel' }).click(); await p.waitForTimeout(500);
  await p.getByRole('menuitem', { name: /Загруз/ }).first().click(); await p.waitForTimeout(800);
  const d = p.locator('[role=dialog]').last();
  await d.locator('textarea').fill('05.10.2026 12:00;+37491000111;Импорт Тестов;Маникюр классический;5000;0;Записан');
  await d.getByRole('button', { name: 'Загрузить' }).click(); await p.waitForTimeout(1500);
  o += 'TOAST ' + await toasts(p) + '\nDLG ' + (await p.locator('[role=dialog]').last().innerText().catch(()=>'')).slice(0,300).replace(/\n+/g,' / ') + '\n';
  await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  const t = await lib.text(p); o += 'after ' + t.match(/Показано\s+(\d+)/)?.[1] + ' hasImport ' + t.includes('Импорт Тестов') + '\n';
  await lib.shot(p, 'o45-import-result');
  } catch (e) { o += 'ERR ' + e.message.slice(0,200); }
  return o;
};
