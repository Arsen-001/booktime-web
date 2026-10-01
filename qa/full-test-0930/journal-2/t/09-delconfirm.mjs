import { waitReady, dlg, btns, toasts } from '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs';
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  await p.locator('[role=dialog]').last().getByRole('button', { name: 'Удалить', exact: true }).last().click(); await p.waitForTimeout(700);
  o += 'TOAST ' + await toasts(p) + '\n';
  o += 'URL ' + p.url() + '\n';
  await lib.shot(p, 'o9-deleted-toast');
  o += 'cardBk ' + await p.locator('[data-booking-id="bk_2381"],[href*="bk_2381"]').count() + '\n';
  o += 'hasLiana10 ' + (await lib.text(p)).includes('Лиана Г.') + '\n';
  await lib.goto(p, '/biz/records'); await waitReady(p);
  await p.getByText('Отменённые', { exact: true }).click(); await p.waitForTimeout(1500);
  const t = await lib.text(p); const i = t.indexOf('Лиана'); o += 'REC ' + t.slice(Math.max(0,i-200), i+500) + '\n';
  await lib.shot(p, 'o9-records-cancelled');
  return o;
};
