import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
console.warn = () => {}; console.error = () => {};
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const L = db.useDb.getState().areas.loyalty;
for (const c of ['cl_002', 'cl_003', 'cl_019', 'cl_077']) {
  console.log(c, JSON.stringify({ mem: L.memberships.filter((m) => m.clientId === c).map((m) => [m.id, m.membershipTypeId, m.balanceVisits, m.status, m.code]), cert: L.certificates.filter((x) => x.clientId === c).map((x) => [x.id, x.code, x.balance, x.certTypeId]), cards: L.cards.filter((x) => x.clientId === c).map((x) => [x.id, x.balance]), acc: L.accounts.filter((x) => x.clientId === c).map((x) => [x.id, x.balance]) }));
}
console.log('aa', JSON.stringify(L.autoApply.biz_nuri));
process.exit(0);
