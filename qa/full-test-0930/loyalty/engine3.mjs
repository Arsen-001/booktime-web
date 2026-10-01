// 01.10: продажи лояльности → касса finance (recordLoyaltySaleSync), одна карта каждого типа
import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
console.warn = () => {}; console.error = () => {};
const db = await jiti.import(root + '/src/mock/db.ts'); await db.bootDb();
const LA = await jiti.import(root + '/src/api/loyalty.ts');
const FA = await jiti.import(root + '/src/api/finance.ts');
const st = () => db.useDb.getState();
const BIZ = 'biz_nuri';
const loc = st().core.businesses.find((b) => b.id === BIZ).locationIds[0];
const L = () => st().areas.loyalty;
const ops = (ref) => st().areas.finance.operations.filter((o) => o.refId === ref && !o.cancelled);
const item = (id) => Object.entries(st().areas.finance.itemBySystemKey[BIZ]).find(([, v]) => v === id)?.[0];
let ok = 0, n = 0;
const check = (c, m) => { n++; if (c) ok++; console.log(c ? '✓' : '✗', m); };
const tiles = await FA.listBookingPaymentTiles(BIZ);
console.log('способы:', tiles.map((t) => `${t.key}→${t.accountId}`).join(', '));
const client = st().core.clients.find((c) => c.businessId === BIZ && !L().accounts.some((a) => a.clientId === c.id));
const mt = L().membershipTypes.find((t) => t.businessId === BIZ && !t.archived);
const m = await LA.sellMembership(BIZ, { membershipTypeId: mt.id, clientId: client.id, locationId: loc, code: 'QA-FIN-M', payment: { methodKey: 'cash' } });
const mo = ops(m.id);
check(mo.length === 1 && mo[0].amount === m.soldPrice && item(mo[0].itemId) === 'membershipSale' && mo[0].partyName === client.name, `абонемент ${m.soldPrice} → операция ${JSON.stringify(mo.map((o) => [o.amount, item(o.itemId), o.method, o.partyName]))}`);
const ct = L().certificateTypes.find((t) => t.businessId === BIZ);
const c = await LA.sellCertificate(BIZ, { certTypeId: ct.id, clientId: client.id, locationId: loc, code: 'QA-FIN-C', payment: { methodKey: 'card' } });
const co = ops(c.id);
check(co.length === 1 && item(co[0].itemId) === 'certificateSale', `сертификат ${c.soldPrice} → ${JSON.stringify(co.map((o) => [o.amount, item(o.itemId), o.method]))}`);
let rolled = false;
try { await LA.sellMembership(BIZ, { membershipTypeId: mt.id, clientId: client.id, locationId: loc, code: 'QA-FIN-BAD', payment: { methodKey: 'nope' } }); } catch (e) { rolled = e.code === 'method_not_found'; }
check(rolled && !L().memberships.some((x) => x.code === 'QA-FIN-BAD'), 'неверный способ → отказ, абонемент не выдан');
const imp = await LA.sellMembership(BIZ, { membershipTypeId: mt.id, clientId: client.id, locationId: loc, code: 'QA-FIN-IMP' });
check(ops(imp.id).length === 0, 'без способа (импорт) — в кассу не пишется');
const at = L().accountTypes.find((a) => a.businessId === BIZ);
const acc = await LA.openAccount(BIZ, client.id, at.id, loc);
const r = await LA.topupAccount(BIZ, acc.id, 7000, undefined, { methodKey: 'cash' });
const to = ops(r.operationId);
check(to.length === 1 && to[0].amount === 7000 && item(to[0].itemId) === 'accountTopUp' && r.account.balance === 7000, `пополнение 7000 → ${JSON.stringify(to.map((o) => [o.amount, item(o.itemId)]))}, баланс ${r.account.balance}`);
let bad = false;
try { await LA.topupAccount(BIZ, acc.id, 3000, undefined, { methodKey: 'nope' }); } catch { bad = true; }
check(bad && L().accounts.find((a) => a.id === acc.id).balance === 7000, 'пополнение с неверным способом откатывается');
const card = L().cards.find((k) => k.businessId === BIZ);
let dup; try { await LA.issueCard(BIZ, card.clientId, card.cardTypeId); dup = 'выдана'; } catch (e) { dup = e.code; }
check(dup === 'card_type_already_issued', `вторая карта того же типа: ${dup}`);
console.log(`Итог ${ok}/${n}`);
process.exit(0);
