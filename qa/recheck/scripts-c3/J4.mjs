import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/journal?booking=bk_1605');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'J4-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
const bk = async (id) => { const d = await db(page); const b = d.core.bookings.find(x => x.id === id); return b; };
await step('second-service', async () => {
  const b0 = await bk('bk_1605'); console.log('before', b0.start, b0.end, JSON.stringify(b0.services ?? b0.serviceIds ?? b0.serviceId), b0.price);
  const dlg = page.locator('[role=dialog]').last();
  const kt = async () => { const t = (await dlg.innerText()).split('\n'); const k = t.findIndex(l => /К оплате/.test(l)); return t.slice(k, k + 2).join(' ') + ' | ' + (t.find(l => /\d\d:\d\d–\d\d:\d\d/.test(l)) || ''); };
  console.log('window before:', await kt());
  await dlg.getByRole('button', { name: /Маникюр классический/ }).first().click(); await page.waitForTimeout(800);
  console.log('window after add:', await kt(), await toasts(page));
  await dlg.getByRole('button', { name: 'Сохранить изменения' }).click(); await page.waitForTimeout(1800);
  const al = page.locator('[role=alertdialog]'); if (await al.count()) { console.log('alert', (await al.last().innerText()).replace(/\n/g,' | ')); await al.last().getByRole('button').last().click(); await page.waitForTimeout(1500); }
  console.log('toasts', await toasts(page));
  const b1 = await bk('bk_1605'); console.log('after', b1.start, b1.end, JSON.stringify(b1.services ?? b1.serviceIds ?? b1.serviceId).slice(0, 200), b1.price);
  await go(page, '/biz/journal'); const t = await T(8000); console.log('grid 18:00 block:', t.split('\n').filter(l => /^18:00–/.test(l)));
});
await step('confirm-paint', async () => {
  const d = await db(page); const today = '2026-09-25'; const b = d.core.bookings.find(x => x.businessId === 'biz_nuri' && x.start.startsWith(today) && x.status === 'scheduled');
  console.log('scheduled today', b?.id, b?.start, b?.staffId);
  if (!b) return;
  await go(page, '/biz/journal?booking=' + b.id);
  const dlg = page.locator('[role=dialog]').last();
  await dlg.getByRole('button', { name: 'Клиент подтвердил' }).click(); await page.waitForTimeout(1200);
  console.log('toasts', await toasts(page), 'status', (await bk(b.id)).status, 'dialog still?', await page.locator('[role=dialog]').count());
});
await step('default-view', async () => {
  await go(page, '/biz/journal/settings').catch(()=>{});
  console.log((await T(600)).replace(/\n/g, ' | '));
});
await stop();
