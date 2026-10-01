import { waitReady, dlg, btns, toasts } from '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs';
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  await p.locator('[role=dialog]').last().getByRole('button', { name: 'Частичный возврат' }).first().click(); await p.waitForTimeout(1000);
  const last = p.locator('[role=dialog],[role=alertdialog]').last();
  o += 'REFUND ' + (await last.innerText()).slice(0,800) + '\n';
  o += 'INPUTS ' + await last.evaluate(d=>[...d.querySelectorAll('input')].map(i=>(i.getAttribute('aria-label')||i.name||i.placeholder)+'='+i.value).join(' ; ')) + '\n';
  const inp = last.locator('input').first(); await inp.fill('2000');
  const b = last.getByRole('button').filter({ hasText: /Вернуть|Возврат|Сохранить|Подтвердить/ }).last();
  o += 'BTN ' + await b.innerText() + '\n';
  await b.click(); await p.waitForTimeout(1500);
  o += 'TOAST ' + await toasts(p) + '\n';
  o += 'AFTER ' + (await p.locator('[role=dialog]').last().innerText()).slice(0,700) + '\n';
  await lib.shot(p, 'o7-refund');
  return o;
};
