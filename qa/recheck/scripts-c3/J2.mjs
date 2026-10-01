import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/journal?new=1&staff=st_nuri_ani&date=2026-09-25&start=10:30');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'J2-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
await step('overlap', async () => {
  const dlg = page.locator('[role=dialog]').last();
  console.log((await dlg.innerText()).replace(/\n/g, ' | ').slice(0, 300));
  await dlg.getByText('Маникюр классический').first().click(); await page.waitForTimeout(500);
  await dlg.getByPlaceholder(/\d\d \d{3}/).first().fill('91 777 888'); await page.waitForTimeout(600);
  const txt = (await dlg.innerText()).split('\n'); const k = txt.indexOf('Начало'); console.log('time fields:', txt.slice(k, k + 8).join(' | '));
  const n0 = (await db(page)).core.bookings.length;
  await dlg.getByRole('button', { name: /^Записать$/ }).click(); await page.waitForTimeout(2000);
  console.log('toasts', await toasts(page), 'dialog open?', await page.locator('[role=dialog]').count());
  const al = page.locator('[role=alertdialog],[role=dialog]').last(); console.log('top dialog:', (await al.innerText()).replace(/\n/g,' | ').slice(0, 200));
  if (await al.getByRole('button', { name: 'Да' }).count()) { await al.getByRole('button', { name: 'Да' }).click(); await page.waitForTimeout(2000); console.log('after Да toasts', await toasts(page)); }
  const dd = await db(page); console.log('bookings', n0, '→', dd.core.bookings.length, 'ani 10:30 now:', dd.core.bookings.filter(b => b.staffId === 'st_nuri_ani' && b.start === '2026-09-25T10:30').map(b => b.id + ':' + b.status));
  await shot(page, 'J2-overlap');
});
await step('skip', async () => {
  await as(page, 'master', '/biz/records');
  const heads = await page.locator('main thead th').allInnerTexts(); console.log('heads', heads);
  const si = heads.findIndex(h => /Специалист/.test(h));
  const specs = await page.locator('main tbody tr').evaluateAll((rs, si) => rs.map(r => r.children[si]?.innerText.trim()), si);
  const cnt = {}; specs.forEach(s => cnt[s] = (cnt[s] || 0) + 1); console.log('rows', specs.length, 'by specialist', cnt);
  await shot(page, 'J2-master-records', true);
});
await stop();
