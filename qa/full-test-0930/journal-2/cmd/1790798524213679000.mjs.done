const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  try {
  await go(p, '/biz/records?demo=owner&sphere=nails&lang=ru'); await waitReady(p); await p.waitForTimeout(1200);
  await p.getByRole('button', { name: 'Операции с Excel' }).click(); await p.waitForTimeout(500);
  o += 'MENU ' + await p.evaluate(()=>[...document.querySelectorAll('[role=menuitem]')].map(m=>m.innerText).join(' | ')) + '\n';
  await p.getByRole('menuitem', { name: /Скачать|Выгруз/ }).first().click(); await p.waitForTimeout(800);
  const d = p.locator('[role=dialog]').last(); o += 'EXPORT ' + (await d.innerText()).slice(0,400).replace(/\n+/g,' / ') + '\n';
  await d.locator('input').first().fill('test@example.com');
  await d.getByRole('button').filter({ hasText: /Отправить|Выгрузить|Скачать/ }).last().click(); await p.waitForTimeout(1200);
  o += 'TOAST ' + await toasts(p) + '\n';
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.getByRole('button', { name: 'Операции с Excel' }).click(); await p.waitForTimeout(500);
  await p.getByRole('menuitem', { name: /Загруз/ }).first().click(); await p.waitForTimeout(800);
  o += 'IMPORT ' + (await p.locator('[role=dialog]').last().innerText()).slice(0,600).replace(/\n+/g,' / ') + '\n';
  await lib.shot(p, 'o44-import');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.getByRole('button', { name: 'Фильтры' }).click(); await p.waitForTimeout(800);
  o += 'FILTERS ' + (await p.locator('[role=dialog]').last().innerText()).slice(0,600).replace(/\n+/g,' / ') + '\n';
  await lib.shot(p, 'o44-filters');
  } catch (e) { o += 'ERR ' + e.message.slice(0,200); await lib.shot(p,'o44-err'); }
  return o;
};
