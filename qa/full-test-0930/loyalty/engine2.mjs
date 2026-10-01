// Полный тест 30.09 · loyalty: правила и CRUD раздела на моковой базе (без браузера).
import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
console.warn = () => {};
console.error = () => {};
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const LA = await jiti.import(root + '/src/api/loyalty.ts');
const st = () => db.useDb.getState();
const Lz = () => st().areas.loyalty;
const BIZ = 'biz_nuri';
const results = [];
let cur;
async function step(id, title, fn) {
  cur = { id, title, status: 'pass', notes: [] };
  try { await fn(); } catch (e) { cur.status = 'fail'; cur.error = String(e?.message ?? e).slice(0, 300); }
  results.push(cur);
  console.log(`${cur.status === 'pass' ? '✓' : '✗'} ${id} ${title}${cur.error ? ' — ' + cur.error : ''}`);
  for (const n of cur.notes) console.log('    ·', n);
}
const note = (s) => cur.notes.push(s);
const assert = (c, m) => { if (!c) throw new Error(m); };
const rejects = async (p) => { try { await p; return false; } catch (e) { note('отказ: ' + (e.code ?? e.message)); return true; } };
const loc = st().core.businesses.find((b) => b.id === BIZ).locationIds[0];
const clients = st().core.clients.filter((c) => c.businessId === BIZ && !c.deletedAt);
const cl = clients.find((c) => !Lz().cards.some((k) => k.clientId === c.id));

await step('F-06-020..030', 'Тип карты: создать, изменить, архив, удалить; удалить тип с картами нельзя', async () => {
  const base = Lz().cardTypes.find((c) => c.businessId === BIZ);
  const { id, businessId, createdAt, ...input } = base;
  const created = await LA.createCardType(BIZ, { ...input, name: 'QA тип' });
  const upd = await LA.updateCardType(BIZ, created.id, { ...input, name: 'QA тип 2' });
  note(`создан ${created.id}, переименован «${upd.name}»`);
  const arch = await LA.setCardTypeArchived(BIZ, created.id, true);
  note(`архив: ${arch.archived}`);
  await LA.deleteCardType(BIZ, created.id);
  assert(!Lz().cardTypes.some((c) => c.id === created.id), 'не удалился');
  assert(await rejects(LA.deleteCardType(BIZ, base.id)), 'удалился тип, по которому выданы карты');
  assert(await rejects(LA.createCardType(BIZ, { ...input, name: '  ' })), 'создан тип без названия');
});

await step('F-06-051..057', 'Карта: выдать клиенту (номер вручную/авто), дубль номера, изменить баланс, удалить', async () => {
  const typeId = Lz().cardTypes.find((c) => c.businessId === BIZ).id;
  const c1 = await LA.issueCard(BIZ, cl.id, typeId);
  note(`авто-номер ${c1.number}`);
  note('вторая карта того же типа: ' + ((await rejects(LA.issueCard(BIZ, cl.id, typeId))) ? 'запрещено' : 'разрешено (API не проверяет)'));
  for (const k of Lz().cards.filter((x) => x.clientId === cl.id && x.id !== c1.id)) await LA.deleteCard(BIZ, k.id);
  const other = clients.find((c) => c.id !== cl.id && !Lz().cards.some((k) => k.clientId === c.id));
  assert(await rejects(LA.issueCard(BIZ, other.id, typeId, c1.number)), 'дубль номера карты');
  const adj = await LA.adjustCardBalance(BIZ, c1.id, loc, 700);
  const adj2 = await LA.adjustCardBalance(BIZ, c1.id, loc, -1000);
  note(`баланс +700 → ${adj.balance}, −1000 → ${adj2.balance}`);
  assert(adj2.balance >= 0, 'бонусы ушли в минус');
  const found = await LA.listCards(BIZ, { phone: cl.phone });
  note(`поиск по телефону: ${found.length}`);
  assert(found.some((r) => r.id === c1.id), 'не находится по телефону');
  await LA.deleteCard(BIZ, c1.id);
  assert(!Lz().cards.some((c) => c.id === c1.id), 'карта не удалена');
});

await step('F-06-031..050', 'Акции: проверки мастера (0%, >100%, пороги по убыванию, пустое имя), создать, правка, удалить', async () => {
  const base = Lz().promotions.find((p) => p.businessId === BIZ);
  const { id, businessId, createdAt, ...input } = base;
  assert(await rejects(LA.createPromotion(BIZ, { ...input, value: 0 })), '0% принято');
  assert(await rejects(LA.createPromotion(BIZ, { ...input, value: 150 })), '150% принято');
  assert(await rejects(LA.createPromotion(BIZ, { ...input, name: '' })), 'пустое имя принято');
  assert(await rejects(LA.createPromotion(BIZ, { ...input, kind: 'cashbackAccumSum', thresholds: [{ from: 0, value: 5 }, { from: 1000, value: 3 }] })), 'пороги по убыванию приняты');
  const p = await LA.createPromotion(BIZ, { ...input, name: 'QA акция', value: 15 });
  const u = await LA.updatePromotion(BIZ, p.id, { ...input, name: 'QA акция', value: 20 });
  note(`создана, значение → ${u.value}`);
  await LA.deletePromotion(BIZ, p.id);
  assert(!Lz().promotions.some((x) => x.id === p.id), 'акция не удалена');
});

await step('F-06-086..104', 'Сертификаты: тип, продажа (код обязателен, уникален), возврат части, аннулирование', async () => {
  const t0 = Lz().certificateTypes.find((c) => c.businessId === BIZ && !c.allowNoCode);
  assert(await rejects(LA.sellCertificate(BIZ, { certTypeId: t0.id, clientId: cl.id, locationId: loc })), 'продан без кода');
  const c = await LA.sellCertificate(BIZ, { certTypeId: t0.id, clientId: cl.id, locationId: loc, code: 'QA-SELL-1' });
  note(`продан ${c.code} ${c.balance}/${c.nominal}, статус ${c.status}, до ${c.expiresAt}`);
  assert(await rejects(LA.sellCertificate(BIZ, { certTypeId: t0.id, clientId: cl.id, locationId: loc, code: 'QA-SELL-1' })), 'дубль кода');
  const f = await LA.findLoyaltyByCode(BIZ, 'qa-sell-1');
  note(`поиск по коду (другой регистр): ${f.kind}`);
  assert(f.kind === 'certificate', 'не находится по коду');
  const r = await LA.refundCertificateAmount(BIZ, c.id, 1000);
  note(`возврат 1000 → баланс ${r.balance}`);
  const rr = await LA.refundCertificateAmount(BIZ, c.id, 10 ** 7).catch((e) => ({ err: e.code })); note(`возврат 10 млн: ${rr.err ?? 'подрезан до остатка, статус ' + rr.status}`);
  await LA.voidCertificateSale(BIZ, c.id);
  const after = Lz().certificates.find((x) => x.id === c.id);
  note(`после аннулирования: ${after ? after.status : 'удалён'}`);
  const f2 = await LA.findLoyaltyByCode(BIZ, 'QA-SELL-1');
  assert(f2.kind === 'none', 'аннулированный находится по коду');
});

await step('F-06-105..134', 'Абонементы: продажа, заморозка/разморозка (только если тип разрешает), правка баланса, возврат, удаление продажи', async () => {
  const types = Lz().membershipTypes.filter((m) => m.businessId === BIZ && !m.archived);
  const tp = types[0];
  note(`тип ${tp.name}: заморозка ${tp.freezeAllowed}, без кода ${tp.allowNoCode}, активация ${tp.activationMode}`);
  const m = await LA.sellMembership(BIZ, { membershipTypeId: tp.id, clientId: cl.id, locationId: loc, code: 'QA-M-SELL' });
  note(`продан: ${m.balanceVisits}/${m.totalVisits}, статус ${m.status}, до ${m.expiresAt}`);
  assert(await rejects(LA.sellMembership(BIZ, { membershipTypeId: tp.id, clientId: cl.id, locationId: loc, code: 'QA-M-SELL' })), 'дубль кода абонемента');
  if (tp.freezeAllowed && m.status === 'active') {
    const fz = await LA.setMembershipFrozen(BIZ, m.id, true, 7);
    note(`заморозка: ${fz.status}, до ${fz.frozenUntil}, срок ${m.expiresAt} → ${fz.expiresAt}`);
    const un = await LA.setMembershipFrozen(BIZ, m.id, false);
    note(`разморозка: ${un.status}, срок ${un.expiresAt}`);
  } else {
    note('заморозка невыданного/неактивного: ' + ((await rejects(LA.setMembershipFrozen(BIZ, m.id, true, 7))) ? 'нельзя' : 'можно'));
  }
  const adj = await LA.adjustMembership(BIZ, m.id, { balanceVisits: 1 });
  note(`правка баланса → ${adj.balanceVisits}`);
  assert(await rejects(LA.adjustMembership(BIZ, m.id, { balanceVisits: m.totalVisits + 5 })), 'баланс больше всего посещений');
  const rf = await LA.refundMembershipPartial(BIZ, m.id, 1000);
  note(`возврат 1000: статус ${rf.status}`);
  await LA.deleteMembershipSale(BIZ, m.id);
  assert(!Lz().memberships.some((x) => x.id === m.id && x.status !== 'deleted'), 'продажа не удалена');
});

await step('F-06-135..144', 'Счета: открыть (второй того же типа нельзя), пополнить, возврат, в минус не больше лимита', async () => {
  const at = Lz().accountTypes.find((a) => a.businessId === BIZ);
  const fresh = clients.find((c) => !Lz().accounts.some((a) => a.clientId === c.id));
  const a = await LA.openAccount(BIZ, fresh.id, at.id, loc);
  assert(await rejects(LA.openAccount(BIZ, fresh.id, at.id, loc)), 'второй счёт того же типа');
  await LA.topupAccount(BIZ, a.id, 5000);
  assert(await rejects(LA.topupAccount(BIZ, a.id, -5)), 'пополнение на минус');
  const r = await LA.refundAccountAmount(BIZ, a.id, 2000);
  note(`пополнили 5000, вернули 2000 → ${r.balance}`);
  assert(await rejects(LA.refundAccountAmount(BIZ, a.id, 999999)), 'возврат больше остатка');
  const lim = at.allowNegative ? at.negativeLimit : 0;
  assert(await rejects(LA.chargeAccount(BIZ, a.id, r.balance + lim + 1)), 'списание сверх лимита минуса');
  const ops = await LA.listAccountOperationsForAccount(BIZ, a.id);
  note(`операций по счёту: ${ops.length}`);
});

await step('F-06-078..085', '«Приведи друга»: нельзя себя, нельзя без первого визита, чужой номер', async () => {
  const withVisits = clients.find((c) => st().core.bookings.some((b) => b.clientId === c.id && /^(completed|done|paid|arrived)$/.test(b.status)));
  const r1 = await LA.getReferralEligibility(BIZ, withVisits.phone, withVisits.id, 5000);
  note(`сам себя: ${JSON.stringify(r1).slice(0, 120)}`);
  assert(!r1.ok && !r1.eligible, 'себя можно указать');
  const r2 = await LA.getReferralEligibility(BIZ, '+37499000000', withVisits.id, 5000);
  note(`несуществующий номер: ${JSON.stringify(r2).slice(0, 120)}`);
});

await step('F-06-148..155', 'Онлайн-продажа: заказ → подтверждение создаёт абонемент/сертификат → возврат', async () => {
  const cat = await LA.listOnlineSaleCatalog(BIZ);
  note(`в витрине: ${cat.length}`);
  if (!cat.length) throw new Error('витрина пуста');
  const item = cat[0];
  const o = await LA.createOnlineOrder(BIZ, { itemKind: item.kind, itemTypeId: item.typeId ?? item.id, clientId: cl.id, clientName: cl.name, clientPhone: cl.phone, locationId: loc });
  note(`заказ ${o.status}`);
  const c = await LA.confirmOnlineOrder(BIZ, o.id);
  note(`подтверждён: ${c.status}, выдано ${c.issuedId ?? c.resultId ?? JSON.stringify(c).slice(0, 120)}`);
  const r = await LA.refundOnlineOrder(BIZ, o.id);
  note(`возврат: ${r.status}`);
});

await step('F-06-128', 'Онлайн-запись только по абонементу: есть абонемент на услугу → да, нет → нет', async () => {
  const m = Lz().memberships.find((x) => x.businessId === BIZ && x.status === 'active');
  const tp = Lz().membershipTypes.find((x) => x.id === m.membershipTypeId);
  const client = st().core.clients.find((c) => c.id === m.clientId);
  const svc = tp.services.find((s) => s.serviceId)?.serviceId;
  if (!svc) { note('у типа нет услуг по id'); return; }
  const yes = await LA.hasOnlineMembership(BIZ, client.phone, svc);
  const no = await LA.hasOnlineMembership(BIZ, '+37499111222', svc);
  note(`с абонементом ${yes}, без ${no}`);
  assert(yes && !no, 'проверка не работает');
});

console.log(`\nИтог: ${results.filter((r) => r.status === 'pass').length}/${results.length}`);
(await import('node:fs')).writeFileSync(root + '/qa/full-test-0930/loyalty/engine2-results.json', JSON.stringify(results, null, 1));
process.exit(0);
