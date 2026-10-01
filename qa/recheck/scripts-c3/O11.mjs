import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('master', '/biz/online/settings');
const T = async (n=1200) => (await text(page)).slice(0, n);
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); } };
await step('master-online', async () => {
  console.log('master /biz/online/settings:', (await T(1500)).split('\n').slice(0, 12).join(' | '));
  for (const r of ['/biz/online', '/biz/online/widget', '/biz/online/page']) { await go(page, r); console.log(r, '→', (await T(120)).replace(/\n/g, ' | ')); }
});
await step('staff-phones', async () => { const d = await db(page); console.log(d.core.staff.filter(s => s.businessId === 'biz_nuri').map(s => s.id + ' ' + s.name + ' ' + s.phone + ' ' + s.role).join('\n')); });
await step('platform-banner', async () => {
  await as(page, 'client', '/'); const t = await T(4000); console.log('home:', t.split('\n').filter(l => /Реклама|реклам|баннер/i.test(l)).slice(0, 4));
  await as(page, 'platform', '/platform/ads'); console.log('ads:', (await T(1500)).split('\n').filter(l => /Идёт|Баннер|баннер/.test(l)).slice(0, 6));
});
await stop();
