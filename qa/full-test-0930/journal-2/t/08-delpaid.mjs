import { waitReady, dlg, btns, toasts } from '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs';
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  await p.locator('[role=dialog]').last().getByRole('button', { name: 'Закрыть' }).click(); await p.waitForTimeout(800);
  const det = p.getByRole('button', { name: 'Посмотреть детали' });
  if (await det.count()) { await det.click(); await p.waitForTimeout(1000); o += 'DETAILS ' + (await p.locator('[role=dialog]').last().innerText()).slice(0,700) + '\n'; await lib.shot(p,'o8-details'); await p.keyboard.press('Escape'); await p.waitForTimeout(600);} else o+='NO DETAILS BTN\n';
  const del = p.locator('[role=dialog]').first().getByRole('button', { name: 'Удалить', exact: true }).first();
  o += 'delDisabled ' + await del.isDisabled() + ' title=' + await del.getAttribute('title') + '\n';
  await del.click({ force: true }).catch(e=>o+='clickerr '+e.message.slice(0,80)+'\n'); await p.waitForTimeout(1200);
  o += 'AFTERDEL ' + (await p.evaluate(()=>[...document.querySelectorAll('[role=alertdialog],[role=dialog]')].map(d=>d.innerText.slice(0,500)).pop())) + '\n';
  o += 'TOAST ' + await toasts(p) + '\n';
  await lib.shot(p, 'o8-delpaid');
  return o;
};
