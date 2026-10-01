import { start, stop, open, go, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('client', '/places/biz_nuri', { device: 'phone' });
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'C5-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
let d0;
await step('buy-membership', async () => {
  d0 = await db(page);
  console.log('client memberships before', (d0.areas.client.memberships || d0.areas.client.clientMemberships || []).length, 'loyalty memberships', d0.areas.loyalty.memberships.filter(m => m.businessId === 'biz_nuri').length, 'certs', d0.areas.loyalty.certificates.filter(m => m.businessId === 'biz_nuri').length);
  
  const sec = await page.locator('main').innerText(); const i = sec.indexOf('Покупки'); console.log(sec.slice(i, i+200).replace(/\n/g,' | '));
  await page.getByRole('button', { name: 'Купить' }).first().click(); await page.waitForTimeout(1000);
  await page.waitForTimeout(1500);
  console.log('toasts', await toasts(page), 'url', page.url());
  const d = await db(page);
  console.log('loyalty memberships after', d.areas.loyalty.memberships.filter(m => m.businessId === 'biz_nuri').length);
  const diff = JSON.stringify(d.areas.client).length - JSON.stringify(d0.areas.client).length; console.log('client slice grew by', diff);
  await go(page, '/memberships'); console.log('client /memberships:', (await T(900)).replace(/\n/g, ' | '));
  await as(page, 'owner', '/biz/loyalty/memberships'); console.log('biz memberships:', (await T(1500)).split('\n').slice(0, 8).join(' | '), '...', (await T(3000)).split('\n').slice(-7).join(' | '));
  await as(page, 'owner', '/biz/finance'); console.log('finance:', (await T(1000)).replace(/\n/g,' | ').slice(0, 600));
});
await stop();
