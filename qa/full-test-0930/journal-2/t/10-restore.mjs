import { waitReady, dlg, btns, toasts } from '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs';
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  const row = p.locator('tr', { hasText: 'Лиана Гаспарян' }).first();
  o += 'ROWBTNS ' + await row.evaluate(r=>[...r.querySelectorAll('button,a')].map(b=>b.getAttribute('aria-label')||b.innerText).join(' | ')) + '\n';
  const rb = row.getByRole('button', { name: /Восстанов/ });
  if (await rb.count()) { await rb.first().click(); await p.waitForTimeout(1500); o += 'TOAST ' + await toasts(p) + '\n';
    await p.getByText('Не отменённые', { exact: true }).click(); await p.waitForTimeout(1000);
    const t = await lib.text(p); o += 'afterRestore liana in active: ' + t.includes('Лиана Гаспарян') + '\n'; }
  await lib.goto(p, '/biz/journal?booking=bk_2381'); await waitReady(p); await p.waitForTimeout(1500);
  const d = await dlg(p); o += 'WINDOW ' + (d.match(/К оплате[\s\S]{0,120}/)||['?'])[0] + '\n';
  const h = d.match(/Данные записи[\s\S]{0,300}/); o += 'DATA ' + (h?h[0]:'') + '\n';
  await lib.shot(p, 'o10-restored');
  return o;
};
