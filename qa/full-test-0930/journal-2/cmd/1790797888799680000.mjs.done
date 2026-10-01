const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  await go(p, '/biz/journal?booking=bk_2383&demo=owner&sphere=nails&lang=ru'); await waitReady(p); await p.waitForTimeout(1500);
  const w = p.locator('[role=dialog]').first();
  const cb = w.getByLabel('Записывает другого посетителя'); o += 'cb checked ' + await cb.isChecked().catch(()=> 'na') + '\n'; if (!(await w.getByPlaceholder('Введите имя посетителя').count())) { await w.getByText('Записывает другого посетителя').click(); await p.waitForTimeout(800); }
  await w.getByPlaceholder('Введите имя посетителя').fill('Давид'); await p.waitForTimeout(800);
  const sug = await p.evaluate(()=>[...document.querySelectorAll('[role=option],[role=listbox] *')].map(e=>e.innerText).slice(0,5).join(' | ')); o += 'SUG ' + sug + '\n';
  await w.getByText('Комментарий', { exact: true }).first().click().catch(()=>{});
  await lib.shot(p, 'o39-visitor-filled');
  await w.getByRole('button', { name: 'Сохранить изменения' }).click(); await p.waitForTimeout(2000);
  o += 'TOAST ' + await toasts(p) + '\n';
  o += 'DLG? ' + (await dlg(p)).slice(0,200).replace(/\n+/g,' / ') + '\n';
  await go(p, '/biz/journal'); await waitReady(p);
  o += 'CARD ' + (await p.locator('[data-testid=booking-block]', { hasText: '15:00' }).first().innerText()).replace(/\n/g,' / ') + '\n';
  await go(p, '/biz/journal?booking=bk_2383&demo=owner&sphere=nails&lang=ru'); await waitReady(p); await p.waitForTimeout(1500);
  const t = await dlg(p); const i = t.indexOf('осетител'); o += 'REOPEN ' + t.slice(i-50, i+300).replace(/\n+/g,' / ') + '\n';
  await lib.shot(p, 'o39-visitor-reopen');
  return o;
};
