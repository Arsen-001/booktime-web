import { start, stop, open, go, text, db } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/clients/cl_029');
const d = await db(page);
for (const id of ['cl_029', 'cl_028', 'cl_018']) {
  await go(page, '/biz/clients/' + id);
  const t = (await text(page)).split('\n'); const i = t.indexOf('Визиты');
  const bks = d.core.bookings.filter(b => b.clientId === id);
  const now = new Date().toISOString().slice(0, 16);
  const arr = bks.filter(b => b.status === 'arrived');
  console.log(id, 'card:', t.slice(i, i + 9).join(' | '), '|| db arrived', arr.length, 'sum', arr.reduce((a, b) => a + (b.price ?? 0), 0), 'past non-cancelled', bks.filter(b => b.start < now && !/cancel/.test(b.status)).map(b => b.status + ':' + b.price).join(','));
}
await stop();
