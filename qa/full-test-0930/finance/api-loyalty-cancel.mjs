// Продажи лояльности ↔ касса: продажа → приход, отмена → приход отменён, возврат → расход «Возврат»
import { createJiti } from 'jiti';
const root = process.env.ROOT || '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const fin = await jiti.import(root + '/src/api/finance.ts');
const loy = await jiti.import(root + '/src/api/loyalty.ts');
const S = () => db.useDb.getState();
let pass = 0, fail = 0; const check = (n, ok, i = '') => { ok ? pass++ : fail++; console.log(ok ? 'PASS' : 'FAIL', n, i); };
const biz = 'biz_atam';
const loc = S().core.businesses.find((b) => b.id === biz).locationIds[0];
const cashAcc = (await fin.listBookingPaymentTiles(biz)).find((t) => t.key === 'cash').accountId;
const bal = async () => (await fin.listAccountsWithBalance(biz)).find((a) => a.id === cashAcc).balance;
const L = S().areas.loyalty;
const mType = L.membershipTypes.find((t) => t.businessId === biz && !t.archived) ?? L.membershipTypes.find((t) => t.businessId === biz);
const cType = L.certificateTypes.find((t) => t.businessId === biz && !t.archived) ?? L.certificateTypes.find((t) => t.businessId === biz);
const client = S().core.clients.find((c) => c.businessId === biz);
const pay = { methodKey: 'cash' };
// Абонемент: продажа 25 000 → отмена
let b0 = await bal();
const m = await loy.sellMembership(biz, { membershipTypeId: mType.id, clientId: client.id, locationId: loc, price: 25000, code: 'QA' + Math.random().toString(36).slice(2, 8), payment: pay });
check('абонемент 25 000 → касса +25 000', (await bal()) === b0 + 25000, `${b0} → ${await bal()}`);
await loy.deleteMembershipSale(biz, m.id);
check('отмена продажи абонемента → касса как до продажи', (await bal()) === b0, `${await bal()} / ${b0}`);
// Абонемент: продажа → частичный возврат 5 000
const m2 = await loy.sellMembership(biz, { membershipTypeId: mType.id, clientId: client.id, locationId: loc, price: 25000, code: 'QA' + Math.random().toString(36).slice(2, 8), payment: pay });
b0 = await bal();
await loy.refundMembershipPartial(biz, m2.id, 5000);
const refOp = S().areas.finance.operations.find((o) => o.refId === m2.id && o.kind === 'expense');
check('частичный возврат абонемента 5 000 → касса −5 000, расход «Возврат»', (await bal()) === b0 - 5000 && Boolean(refOp), `${b0} → ${await bal()}`);
// Сертификат: продажа → частичный возврат 5 000 → отмена остатка
if (cType) {
  b0 = await bal();
  const c = await loy.sellCertificate(biz, { certTypeId: cType.id, clientId: client.id, locationId: loc, price: 20000, code: 'QA' + Math.random().toString(36).slice(2, 8), payment: pay });
  const sold = await bal() - b0;
  check('сертификат → приход в кассу', sold > 0, String(sold));
  await loy.refundCertificateAmount(biz, c.id, 5000);
  check('возврат с сертификата 5 000 → касса −5 000', (await bal()) === b0 + sold - 5000, `${await bal()}`);
  const c2 = await loy.sellCertificate(biz, { certTypeId: cType.id, clientId: client.id, locationId: loc, price: 20000, code: 'QA' + Math.random().toString(36).slice(2, 8), payment: pay });
  const before = await bal();
  await loy.voidCertificateSale(biz, c2.id);
  check('отмена продажи сертификата → приход отменён', (await bal()) === before - (c2.soldPrice ?? 20000), `${before} → ${await bal()}`);
} else console.log('нет типа сертификата');
// Счёт: пополнение 10 000 → возврат 3 000 → отмена пополнения
const acc = L.accounts.find((a) => a.businessId === biz);
if (acc) {
  b0 = await bal();
  const r = await loy.topupAccount(biz, acc.id, 10000, undefined, pay);
  check('пополнение счёта 10 000 → касса +10 000', (await bal()) === b0 + 10000);
  await loy.refundAccountAmount(biz, acc.id, 3000);
  check('возврат со счёта 3 000 → касса −3 000', (await bal()) === b0 + 7000, `${await bal() - b0}`);
  const opId = r.operationId ?? r.operation?.id ?? S().areas.loyalty.accountOperations.filter((o) => o.accountId === acc.id && o.type === 'topup').at(-1).id;
  const b1 = await bal();
  await loy.cancelAccountTopup(biz, acc.id, opId).catch((e) => console.log('cancel err', e.message));
  check('отмена пополнения → приход отменён', (await bal()) === b1 - 10000, `${b1} → ${await bal()}`);
} else console.log('нет счёта');
console.log(`ИТОГ ${pass}/${pass + fail}`); process.exit(0);
