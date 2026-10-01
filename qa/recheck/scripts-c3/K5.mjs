import { start, stop, open, go, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/clients');
const T = async (n=1200) => (await text(page, 'body')).slice(0, n);
const d = await db(page);
const ns = {}; d.core.bookings.filter(b => b.businessId === 'biz_nuri' && /no_?show/.test(b.status)).forEach(b => ns[b.clientId] = (ns[b.clientId] || 0) + 1);
const pick = Object.entries(ns).sort((a, b) => b[1] - a[1]).slice(0, 2); console.log('clients with no-shows (real):', pick, 'statuses', [...new Set(d.core.bookings.map(b => b.status))]);
for (const [cid, n] of [...pick, ['cl_018', 0]]) {
  const c = d.core.clients.find(x => x.id === cid);
  const arrived = d.core.bookings.filter(b => b.clientId === cid && b.status === 'arrived').length;
  await go(page, `/biz/journal?new=1&client=${cid}`);
  const dlg = page.locator('[role=dialog]').last(); await page.waitForTimeout(1000);
  const t = (await dlg.innerText()).split('\n').filter(Boolean); const i = t.findIndex(l => /Не пришёл \d|Не пришёл$/.test(l.trim()) && !/Статус/.test(l)); 
  await page.getByRole('tab', { name: 'Клиент' }).click().catch(()=>{}); await page.waitForTimeout(1000); const t2 = (await dlg.innerText()).split('\n').filter(Boolean); console.log('   client tab:', t2.filter(l => /Визит|пришёл|пришел|Продано|Баланс|\d/.test(l)).slice(0, 20).join(' | '));
  console.log(cid, c?.name, 'real noShow=', n, 'field noShowCount=', c?.noShowCount, 'arrived=', arrived, '| window:', t.slice(Math.max(0, i - 3), i + 12).join(' | '), '| category?', t.some(l => /аллергия/.test(l)));
  await shot(page, 'K5-window-' + cid);
}
await stop();
