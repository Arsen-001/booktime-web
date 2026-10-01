import { start, stop, open, go, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('individual', '/biz/apps/branded');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'C8-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
await step('desc-validation', async () => {
  const ta = page.locator('main textarea').first();
  await ta.fill('Звоните +374 91 234 567 или пишите на www.nuri.am'); await ta.blur(); await page.waitForTimeout(600);
  const t = await T(12000); console.log('errors:', t.split('\n').filter(l => /Уберите/i.test(l)).slice(0, 5));
  const sn = page.locator('main input').filter({ hasNot: page.locator('[type=checkbox]') });
});
await step('news-subscribers', async () => {
  await as(page, 'owner', '/biz/apps/news');
  const d0 = await db(page);
  const staffIds = d0.core.staff.filter(s => s.businessId === 'biz_nuri').map(s => s.id);
  const subs = d0.areas.client.favorites.filter(f => !f.newsMuted && (f.targetId === 'biz_nuri' || staffIds.includes(f.targetId))).map(f => f.appUserId);
  console.log('subscribers', [...new Set(subs)], 'au_01 subscribed?', subs.includes('au_01'));
  await page.locator('main textarea').fill('Новость C3 проверка'); await page.getByRole('button', { name: 'Отправить' }).click(); await page.waitForTimeout(1500);
  console.log('toasts', await toasts(page));
  const d = await db(page); const n = d.areas.client.notifications.filter(x => x.params?.text === 'Новость C3 проверка'); console.log('notified', n.map(x => x.appUserId));
  await as(page, 'client', '/notifications'); const t = await T(3000); console.log('au_01 sees news?', t.includes('Новость C3'));
});
await stop();
