import { start, stop, open, go, text, db } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/clients/cl_018');
for (const id of ['cl_018', 'cl_081', 'cl_013']) {
  await go(page, '/biz/clients/' + id);
  const t = (await text(page)).split('\n');
  console.log(id, JSON.stringify(t.filter(l => /Оплачено|Долг|Аванс|Продано|оплачено|абонем/i.test(l)).slice(0, 14)));
}
const d = await db(page);
const bk = d.core.bookings.filter(b => b.clientId === 'cl_018'); console.log('cl_018 bookings', bk.map(b => [b.start, b.status, b.price ?? b.total, b.paid ?? b.paidAmount].join('/')).join(' ; '));
const c = d.core.clients.find(c => c.id === 'cl_018'); console.log('client rec', JSON.stringify(c).slice(0, 600));
console.log('clients area keys', Object.keys(d.areas.clients));
await stop();
