import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/loyalty/card-types/new');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'L3-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
await step('create-type', async () => {
  await page.getByPlaceholder(/Карта постоянного клиента/).fill('Карта C3');
  await page.getByRole('button', { name: 'Сохранить' }).click(); await page.waitForTimeout(1500);
  console.log('toasts', await toasts(page), 'url', page.url());
  await go(page, '/biz/loyalty/card-types'); await reload(page);
  console.log(await T(500));
});
await step('cards-count', async () => {
  const d = await db(page); const lo = d.areas.loyalty;
  const t = lo.cardTypes.filter(x => x.businessId === 'biz_nuri'); console.log('types', t.map(x => x.id + ':' + x.name + ':' + x.issuedCount));
  const byT = {}; lo.cards.forEach(c => { byT[c.cardTypeId] = (byT[c.cardTypeId] || 0) + 1; }); console.log('cards by type', byT);
});
await step('client-card-before', async () => {
  await go(page, '/biz/clients/cl_075');
  const t = await T(4000); console.log('has 1074?', t.includes('1074'), '| loyalty lines:', t.split('\n').filter(l => /карт|Карт|лояль/i.test(l)).slice(0, 8));
});
await step('delete-type', async () => {
  await go(page, '/biz/loyalty/card-types');
  await page.getByRole('button', { name: /Постоянный гость/ }).click(); await page.waitForTimeout(1500);
  console.log('url', page.url());
  const del = page.getByRole('button', { name: /Удалить/ });
  console.log('delete buttons', await del.count());
  await del.first().click(); await page.waitForTimeout(800);
  const dlg = page.locator('[role=dialog],[role=alertdialog]').last();
  console.log('confirm text:', (await dlg.innerText()).slice(0, 500));
  await shot(page, 'L3-delete-confirm');
  await dlg.getByRole('button', { name: /Удалить/ }).last().click(); await page.waitForTimeout(1500);
  console.log('toasts', await toasts(page));
  const d = await db(page); const lo = d.areas.loyalty;
  console.log('cards left biz_nuri', lo.cards.filter(c => c.businessId === 'biz_nuri').length, 'promos', JSON.stringify(lo.promotions.filter(p=>p.businessId==='biz_nuri').map(p => [p.name, p.cardTypeIds])));
  await go(page, '/biz/loyalty/cards'); console.log('cards page:', (await T(400)).replace(/\n/g,' | '));
  await go(page, '/biz/clients/cl_075'); const t = await T(4000); console.log('client card still has 1074?', t.includes('1074'));
  await go(page, '/biz/loyalty/transactions'); console.log('tx page:', (await T(900)).split('\n').slice(-6).join(' | '));
});
await step('promo-wizard', async () => {
  await go(page, '/biz/loyalty/promotions/new');
  console.log(await T(800));
  await shot(page, 'L3-promo-new');
});
await stop();
