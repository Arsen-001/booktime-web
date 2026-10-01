import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
console.warn = () => {}; console.error = () => {};
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const LA = await jiti.import(root + '/src/api/loyalty.ts');
const s = db.useDb.getState();
const BIZ = 'biz_nuri';
const today = new Date(Date.now() + Number(process.env.DAYS ?? 1) * 86400e3).toLocaleDateString('sv-SE');
const bs = s.core.bookings.filter((b) => b.businessId === BIZ && !b.deletedAt && b.clientId && b.total > 0 && /^(scheduled|client_confirmed)$/.test(b.status) && b.start.startsWith(today));
const out = [];
for (const b of bs) {
  const visit = { lines: b.services.map((l) => ({ serviceId: l.serviceId, price: Math.round(l.price * l.qty), listPrice: Math.round((l.unitPrice ?? l.price) * l.qty) })), locationId: b.locationId, bookingId: b.id };
  const sm = await LA.getLoyaltyBookingSummary(BIZ, b.clientId, visit);
  const acc = await LA.listClientAccounts(BIZ, b.clientId);
  const promos = await LA.listApplicablePromotions(BIZ, b.clientId, visit);
  const r = { id: b.id, start: b.start, total: b.total, client: b.clientId, mem: sm.memberships.filter((m) => m.applicable && m.coverAmount > 0).map((m) => m.typeName), cert: sm.certificates.filter((c) => c.coverAmount > 0).map((c) => c.code), cards: sm.cards.filter((c) => c.balance > 0).map((c) => c.cardTypeName + ':' + c.balance), acc: acc.map((a) => a.balance), promos: promos.length };
  if (r.mem.length || r.cert.length || r.cards.length || r.acc.length || r.promos) out.push(r);
}
console.log(today, bs.length);
for (const r of out) console.log(JSON.stringify(r));
process.exit(0);
