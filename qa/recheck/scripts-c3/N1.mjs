import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/notifications/inbox');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'N1-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
await step('inbox-tap', async () => {
  const items = page.locator('main a, main button').filter({ hasText: /Новая (онлайн-)?запись/ });
  console.log('items', await items.count(), await items.first().getAttribute('href').catch(()=>null));
  for (const k of [0, 3]) {
    await go(page, '/biz/notifications/inbox');
    const it = page.locator('main a, main button').filter({ hasText: /Новая (онлайн-)?запись/ }).nth(k);
    const href = await it.getAttribute('href'); await it.click(); await page.waitForTimeout(2500);
    const dlg = page.locator('[role=dialog]').last(); const dt = (await dlg.innerText().catch(()=>'')).replace(/\n/g, ' | ').slice(0, 150);
    const bid = (page.url().match(/booking=([\w-]+)/) || [])[1]; const b = bid ? (await db(page)).core.bookings.find(x => x.id === bid) : null;
    console.log(k, 'href', href, '→', page.url().replace(/^.*3710/, ''), '| booking', bid, b?.start, '| window:', dt);
  }
  await shot(page, 'N1-inbox-tap');
});
await step('journal-booking-message', async () => {
  const d0 = await db(page); const ml0 = JSON.stringify(d0.areas.notify).length;
  await go(page, '/biz/journal?new=1&staff=st_nuri_ani&date=2026-09-30&start=12:00');
  const dlg = page.locator('[role=dialog]').last();
  await dlg.getByText('Маникюр классический').first().click(); await page.waitForTimeout(400);
  await dlg.getByPlaceholder(/\d\d \d{3}/).first().fill('91 555 777'); await page.waitForTimeout(500);
  await dlg.getByRole('button', { name: /^Записать$/ }).click(); await page.waitForTimeout(2000);
  const top = page.locator('[role=dialog]').last(); const yes = top.getByRole('button', { name: 'Да', exact: true }); if (await yes.count()) { await yes.click(); await page.waitForTimeout(1500); }
  console.log('toasts', await toasts(page));
  await go(page, '/biz/notifications/log'); const rows = await page.locator('main tbody tr').allInnerTexts(); console.log('log top:', rows.slice(0, 3).map(r => r.replace(/\s+/g, ' ').slice(0, 160)));
  console.log('mentions 91 555 777:', rows.filter(r => /91\s?555\s?777|37491555777/.test(r)).map(r => r.replace(/\s+/g,' ').slice(0, 160)));
});
await stop();
