const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  try {
  await go(p, '/biz/journal?booking=bk_2383&demo=owner&sphere=nails&lang=ru'); await waitReady(p); await p.waitForTimeout(1500);
  const w = p.locator('[role=dialog]', { hasText: 'Статус визита' }).first();
  const pay = async () => { const t = await w.innerText(); const k = t.lastIndexOf('К оплате'); return t.slice(k, k+30).replace(/\n+/g,' '); };
  o += 'qty btn labels ' + await w.evaluate(d=>[...d.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')).filter(Boolean).join('|')) + '\n';
  o += 'BEFORE ' + await pay() + '\n';
  await w.getByRole('button', { name: /^Маникюр аппаратный/ }).first().click(); await p.waitForTimeout(800);
  await w.getByRole('button', { name: '+', exact: true }).first().click(); await p.waitForTimeout(700);
  o += 'AFTER+ ' + await pay() + ' itog=' + await w.evaluate(d=>[...d.querySelectorAll('input')].map(i=>i.value).join(',')) + '\n';
  await lib.shot(p, 'o41-qty');
  await w.getByRole('tab', { name: 'Расходники' }).click().catch(async()=>{ await w.getByText('Расходники', { exact: true }).first().click(); });
  await p.waitForTimeout(800);
  const t = await w.innerText(); const i = t.indexOf('Списание расходников'); o += 'CONS ' + t.slice(i, i+300).replace(/\n+/g,' / ') + '\n';
  const cb = w.getByText('Списание расходников', { exact: true }).first(); await cb.click(); await p.waitForTimeout(1200);
  o += 'CONSOPEN ' + (await p.locator('[role=dialog]').last().innerText()).slice(0,500).replace(/\n+/g,' / ') + '\n';
  await lib.shot(p, 'o41-consumables');
  } catch (e) { o += 'ERR ' + e.message.slice(0,200); await lib.shot(p,'o41-err'); }
  return o;
};
