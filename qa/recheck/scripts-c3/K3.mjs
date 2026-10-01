import { start, stop, open, go, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('master', '/biz/clients');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'K3-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
await step('master-scope', async () => {
  const t = await T(600); console.log(t.split('\n').filter(l => /клиент|Найдено|из \d+/.test(l)).slice(0, 4));
  const d = await db(page);
  const me = (await page.locator('header').first().innerText()).replace(/\n/g,' ');
  console.log('header', me.slice(0, 200));
  const ani = 'st_nuri_ani';
  for (const sid of d.core.staff.filter(s => s.businessId === 'biz_nuri').map(s => s.id)) {
    const n = new Set(d.core.bookings.filter(b => b.staffId === sid && b.clientId).map(b => b.clientId)).size; console.log(' staff', sid, 'distinct clients', n);
  }
  const phones = await page.locator('main tbody tr').evaluateAll(rs => rs.slice(0, 3).map(r => r.innerText.replace(/\s+/g,' ')));
  console.log('rows', phones);
});
await step('master-phone-elsewhere', async () => {
  await go(page, '/biz/journal');
  const blocks = page.locator('main [data-booking-id], main button').filter({ hasText: /\+374/ }); console.log('journal elements with +374', await blocks.count(), (await blocks.allInnerTexts()).slice(0, 3).map(s => s.replace(/\s+/g,' ').slice(0, 120)));
  const t = await T(20000); console.log('full numbers on journal page:', (t.match(/\+374 \d\d \d{3} \d{3}/g) || []).slice(0, 5));
  await go(page, '/biz/records'); const r = await T(20000); console.log('full numbers on records:', (r.match(/\+374 \d\d \d{3} \d{3}/g) || []).length, (r.match(/\+374 \d\d \d{3} \d{3}/g) || []).slice(0, 3));
  // global search
  const s = page.getByPlaceholder('Поиск по клиентам, записям, услугам'); if (await s.count()) { await s.fill('98'); await page.waitForTimeout(1500); const res = await page.locator('[role=listbox],[role=dialog]').allInnerTexts(); console.log('global search:', res.join(' ').replace(/\s+/g,' ').slice(0, 300), '| full numbers:', (res.join(' ').match(/\+374 \d\d \d{3} \d{3}/g)||[]).slice(0,3)); }
  await shot(page, 'K3-master-search');
});
await stop();
