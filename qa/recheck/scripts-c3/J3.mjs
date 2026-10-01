import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/journal?booking=bk_1605');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'J3-fail-' + name.replace(/\W+/g,'_')); } };
await step('repeat', async () => {
  const dlg = page.locator('[role=dialog]').last();
  await dlg.getByText('Повторение записи').click(); await page.waitForTimeout(1000);
  const t = (await dlg.innerText()).split('\n'); const k = t.findIndex(l => /Повторение записи/.test(l)); console.log('repeat block:', t.slice(k + 20, k + 60).join(' | '));
  await shot(page, 'J3-repeat-open');
  const ctl = await dlg.locator('input, [role=combobox], [role=radio], [role=switch]').evaluateAll(a => a.map(x => `${x.tagName}[${x.getAttribute('role')||x.type}] ${x.getAttribute('aria-label')||x.placeholder||''}=${x.value||x.innerText||''}`.slice(0, 80)));
  const n0 = (await db(page)).core.bookings.length;
  await dlg.getByRole('button', { name: 'Создать повторения' }).click(); await page.waitForTimeout(2500);
  console.log('toasts', await toasts(page));
  const al = page.locator('[role=alertdialog]'); if (await al.count()) console.log('alert', (await al.last().innerText()).replace(/\n/g,' | '));
  const d = await db(page); const nb = d.core.bookings.slice(n0); console.log('created', nb.length, nb.map(b => b.start + ' ' + b.staffId + ' ' + b.clientId + ' ' + b.status).join(' ; '));
  await shot(page, 'J3-after-repeat');
  for (const day of ['2026-09-25','2026-10-02','2026-10-09','2026-10-16','2026-10-23','2026-10-30']) { const x = d.core.bookings.filter(b => b.staffId === 'st_nuri_ani' && b.start.startsWith(day) && !/cancel/.test(b.status)).map(b => b.start.slice(11) + '-' + (b.end||'').slice(11) + '(' + (b.duration||'') + ')'); console.log(day, x.join(' ')); }
  const sch = d.core.schedules.filter(s => s.staffId === 'st_nuri_ani').slice(0,3); console.log('sched sample', JSON.stringify(sch).slice(0, 400));
});
await stop();
