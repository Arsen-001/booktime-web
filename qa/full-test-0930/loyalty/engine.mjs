// Полный тест 30.09 · loyalty: движок оплаты лояльностью на моковой базе (без браузера, через jiti).
// node qa/full-test-0930/loyalty/engine.mjs
import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
const origWarn = console.warn;
console.warn = () => {};
console.error = () => {};
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const LA = await jiti.import(root + '/src/api/loyalty.ts');
const JA = await jiti.import(root + '/src/api/journal.ts');
const FA = await jiti.import(root + '/src/api/finance.ts');
const st = () => db.useDb.getState();
const Lz = () => st().areas.loyalty;
const BIZ = 'biz_nuri';
const results = [];
let cur;
async function step(id, title, fn) {
  cur = { id, title, status: 'pass', notes: [] };
  try { await fn(); } catch (e) { cur.status = 'fail'; cur.error = String(e?.message ?? e).slice(0, 400); }
  results.push(cur);
  console.log(`${cur.status === 'pass' ? '✓' : '✗'} ${id} ${title}${cur.error ? ' — ' + cur.error : ''}`);
  for (const n of cur.notes) console.log('    ·', n);
}
const note = (s) => cur.notes.push(s);
const assert = (c, m) => { if (!c) throw new Error(m); };
const today = new Date().toISOString().slice(0, 10);
const visitOf = (b) => ({ lines: b.services.map((l) => ({ serviceId: l.serviceId, price: Math.round(l.price * l.qty), listPrice: Math.round((l.unitPrice ?? l.price) * l.qty) })), locationId: b.locationId, bookingId: b.id });
const pay = (b, lines) => LA.payVisitWithLoyalty({ businessId: BIZ, locationId: b.locationId, bookingId: b.id, clientId: b.clientId, lines, visit: visitOf(b), labelOf: (l) => 'QA ' + l.kind });
const fin = (b) => FA.getBookingPaymentSummary(BIZ, b.id);

// подготовка: записи, клиенты, лояльность
const bookings = st().core.bookings.filter((b) => b.businessId === BIZ && !b.deletedAt && b.clientId && b.total >= 4000 && /^(scheduled|client_confirmed)$/.test(b.status) && b.start >= today);
const byClient = new Map();
for (const b of bookings) if (!byClient.has(b.clientId)) byClient.set(b.clientId, b);
const B = [...byClient.values()];
console.log('записей-кандидатов', B.length, 'seededAt', st().meta.seededAt);
const loc = B[0].locationId;
const ct = Lz().cardTypes.filter((c) => c.businessId === BIZ);
const certT = Lz().certificateTypes.filter((c) => c.businessId === BIZ);
const accT = Lz().accountTypes.find((c) => c.businessId === BIZ);
const memT = Lz().membershipTypes.filter((c) => c.businessId === BIZ);
console.log('типы карт', ct.map((c) => `${c.id}:${c.name}:${c.paymentLimitPercent}%`).join(', '));
console.log('типы серт.', certT.map((c) => `${c.id}:${c.chargeType}:${c.applyServicesMode}`).join(', '));
console.log('типы абон.', memT.map((c) => `${c.id}:${c.balanceMode}:${c.services.map((s) => s.serviceId ?? s.categoryId).join('+')}`).join(', '));
console.log('акции', Lz().promotions.filter((p) => p.businessId === BIZ).map((p) => `${p.id}:${p.kind}:${p.value}:${p.cardTypeIds}`).join(', '));

const now = new Date().toISOString().slice(0, 19);
const exp = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
const [b1, b2, b3, b4, b5, b6, b7] = B;
db.useDb.getState().mutateArea?.('loyalty', () => {});
const mutate = (fn) => {
  const s = st();
  const next = structuredClone(s.areas.loyalty);
  fn(next);
  db.useDb.setState({ areas: { ...s.areas, loyalty: next } });
};
mutate((L) => {
  const baseT = L.membershipTypes.find((x) => x.businessId === BIZ);
  L.membershipTypes.push({ ...baseT, id: 'lmt_qa', name: 'QA shared', balanceMode: 'shared', sharedVisits: 5, archived: false });
  L.membershipTypes.push({ ...baseT, id: 'lmt_qa_other', name: 'QA чужая услуга', balanceMode: 'separate', services: [{ serviceId: 'svc_nonexistent', visits: 5 }], archived: false });
  const baseM = L.memberships.find((x) => x.businessId === BIZ);
  L.memberships.push({ ...baseM, id: 'lm_qa', membershipTypeId: 'lmt_qa', clientId: b1.clientId, status: 'active', balanceVisits: 5, totalVisits: 5, locationId: loc, soldAt: now, expiresAt: exp, frozenDays: 0, frozenUntil: undefined, freezeHistory: [], code: 'QA-M-1' });
  L.memberships.push({ ...baseM, id: 'lm_qa_other', membershipTypeId: 'lmt_qa_other', clientId: b5.clientId, status: 'active', balanceVisits: 5, totalVisits: 5, locationId: loc, soldAt: now, expiresAt: exp, frozenDays: 0, frozenUntil: undefined, freezeHistory: [], code: 'QA-M-2' });
  const multi = L.certificateTypes.find((x) => x.businessId === BIZ);
  L.certificateTypes.push({ ...multi, id: 'lcty_qa_multi', chargeType: 'multiple', applyServicesMode: 'all' });
  L.certificateTypes.push({ ...multi, id: 'lcty_qa_single', chargeType: 'single', applyServicesMode: 'all' });
  L.certificates.push({ id: 'lcert_qa', businessId: BIZ, certTypeId: 'lcty_qa_multi', code: 'QA-C-1', nominal: 50000, balance: 50000, status: 'active', clientId: b1.clientId, locationId: loc, soldAt: now, expiresAt: exp });
  L.certificates.push({ id: 'lcert_qa_s', businessId: BIZ, certTypeId: 'lcty_qa_single', code: 'QA-C-2', nominal: 50000, balance: 50000, status: 'active', clientId: b6.clientId, locationId: loc, soldAt: now, expiresAt: exp });
  L.cards = L.cards.filter((c) => ![b1, b2, b3, b4].some((b) => b.clientId === c.clientId));
  L.cards.push({ id: 'lc_qa1', businessId: BIZ, cardTypeId: ct[0].id, clientId: b1.clientId, number: '777001', balance: 50000, maxPercentDiscount: 50, createdAt: now });
  L.cards.push({ id: 'lc_qa3', businessId: BIZ, cardTypeId: ct[0].id, clientId: b3.clientId, number: '777003', balance: 0, maxPercentDiscount: 50, createdAt: now });
  L.cardTypes.push({ ...L.cardTypes.find((c) => c.id === ct[0].id), id: 'lct_qa_cb', name: 'QA кэшбэк' });
  L.promotions.push({ ...L.promotions.find((p) => p.businessId === BIZ), id: 'lp_qa_cb', name: 'QA кэшбэк 5%', kind: 'cashbackFixed', valueType: 'percent', value: 5, cardTypeIds: ['lct_qa_cb'], applyFrequency: 1, applyLimit: 0, sourceScope: 'activeLocations' });
  L.cards.push({ id: 'lc_qa4', businessId: BIZ, cardTypeId: 'lct_qa_cb', clientId: b4.clientId, number: '777004', balance: 0, maxPercentDiscount: 50, createdAt: now });
  L.accounts.push({ id: 'lacc_qa', businessId: BIZ, accountTypeId: accT.id, clientId: b2.clientId, locationId: loc, balance: 3000, createdAt: now });
  L.accounts.push({ id: 'lacc_qa7', businessId: BIZ, accountTypeId: accT.id, clientId: b7.clientId, locationId: loc, balance: 50000, createdAt: now });
});
console.log('тип счёта', accT.name, 'минус', accT.allowNegative, accT.negativeLimit);

await step('P1', 'Сводка лояльности клиента к визиту: абонемент/сертификат/карта видны', async () => {
  const s = await LA.getLoyaltyBookingSummary(BIZ, b1.clientId, visitOf(b1));
  note(`абонементы ${s.memberships.map((m) => `${m.typeName}:applicable=${m.applicable}:cover=${m.coverAmount}`).join(';')} | серт ${s.certificates.map((c) => `${c.code}:${c.coverAmount}`).join(';')} | карты ${s.cards.map((c) => `${c.cardTypeName}:${c.balance}`).join(';')}`);
  assert(s.memberships.some((m) => m.id === 'lm_qa' && m.applicable), 'абонемент не применим');
  assert(s.certificates.some((c) => c.id === 'lcert_qa'), 'нет сертификата');
  assert(s.cards.some((c) => c.id === 'lc_qa1'), 'нет карты');
});

await step('P2', 'Абонемент закрывает визит: −1 посещение, строка в журнале, скидка-зеркало в финансах, «К оплате» 0', async () => {
  const ex = await pay(b1, [{ kind: 'membership', amount: b1.total, membershipId: 'lm_qa' }]);
  const m = Lz().memberships.find((x) => x.id === 'lm_qa');
  const f = await fin(b1);
  note(`визит ${b1.total}; абонемент ${m.balanceVisits}/5; journal paid ${ex.paidAmount}; finance due ${f.due}, payments ${JSON.stringify(f.payments.map((p) => [p.kind, p.amount, p.cancelled ?? false]))}`);
  assert(m.balanceVisits === 4, 'не списано посещение');
  assert(ex.paidAmount === b1.total, 'журнал не видит оплату');
  assert(f.due === 0, `finance: К оплате ${f.due}`);
});

await step('P3', 'Повторная оплата абонементом того же визита невозможна (нет долга)', async () => {
  const f = await fin(b1);
  try {
    await pay(b1, [{ kind: 'membership', amount: b1.total, membershipId: 'lm_qa' }]);
    const m = Lz().memberships.find((x) => x.id === 'lm_qa');
    note(`второй раз прошло: абонемент ${m.balanceVisits}/5, due был ${f.due}`);
    throw new Error(`движок дал оплатить оплаченный визит ещё раз — списано второе посещение (${m.balanceVisits}/5)`);
  } catch (e) {
    if (String(e.message).startsWith('движок')) throw e;
    note('отказ: ' + e.message);
  }
});

await step('P4', 'Отмена строки возвращает посещение, снимает строки в журнале и финансах', async () => {
  // снимаем все строки лояльности визита
  let ex = await JA.getBookingExtras(b1.id);
  for (const line of [...(ex.payments ?? [])]) ex = await LA.cancelVisitPaymentLine({ businessId: BIZ, locationId: b1.locationId, bookingId: b1.id, clientId: b1.clientId, visit: visitOf(b1) }, line);
  const m = Lz().memberships.find((x) => x.id === 'lm_qa');
  const f = await fin(b1);
  note(`абонемент ${m.balanceVisits}/5; journal ${ex.paidAmount}; finance due ${f.due}, активных строк ${f.payments.filter((p) => !p.cancelled).length}`);
  assert(m.balanceVisits === 5, `посещения ${m.balanceVisits}/5 после отмены`);
  assert(ex.paidAmount === 0 && f.due === b1.total, 'деньги/долг не вернулись');
});

await step('P5', 'Многоразовый сертификат: списывается сумма визита, остаток живёт', async () => {
  await pay(b1, [{ kind: 'certificate', amount: b1.total, certificateId: 'lcert_qa' }]);
  const c = Lz().certificates.find((x) => x.id === 'lcert_qa');
  const f = await fin(b1);
  note(`50000 → ${c.balance} (${c.status}); finance due ${f.due}`);
  assert(c.balance === 50000 - b1.total && c.status === 'active', 'неверный остаток');
  assert(f.due === 0, 'finance не видит оплату');
  await LA.cancelVisitPayments({ businessId: BIZ, locationId: b1.locationId, bookingId: b1.id, clientId: b1.clientId, visit: visitOf(b1) });
  const c2 = Lz().certificates.find((x) => x.id === 'lcert_qa');
  const f2 = await fin(b1);
  note(`после «Отменить оплату» целиком: ${c2.balance}; finance due ${f2.due}`);
  assert(c2.balance === 50000 && f2.due === b1.total, 'полная отмена не вернула сертификат/долг');
});

await step('P6', 'Однократный сертификат: остаток сгорает; отмена возвращает всё', async () => {
  await pay(b6, [{ kind: 'certificate', amount: b6.total, certificateId: 'lcert_qa_s' }]);
  const c = Lz().certificates.find((x) => x.id === 'lcert_qa_s');
  note(`50000 → ${c.balance} (${c.status}), визит ${b6.total}`);
  assert(c.balance === 0 && c.status === 'used', 'остаток не сгорел');
  await LA.cancelVisitPayments({ businessId: BIZ, locationId: b6.locationId, bookingId: b6.id, clientId: b6.clientId, visit: visitOf(b6) });
  const c2 = Lz().certificates.find((x) => x.id === 'lcert_qa_s');
  note(`после отмены ${c2.balance} (${c2.status})`);
  assert(c2.balance === 50000 && c2.status === 'active', 'не вернулся');
});

await step('P7', 'Бонусы: не больше лимита типа карты', async () => {
  const info = await LA.getBonusChargeInfo(BIZ, 'lc_qa1', b1.total, visitOf(b1));
  note(`визит ${b1.total}, лимит ${ct[0].paymentLimitPercent}% → max ${info.max}`);
  await pay(b1, [{ kind: 'bonus', amount: b1.total, cardId: 'lc_qa1' }]);
  const card = Lz().cards.find((c) => c.id === 'lc_qa1');
  const f = await fin(b1);
  note(`списано ${50000 - card.balance}; finance due ${f.due}`);
  assert(50000 - card.balance <= Math.ceil((b1.total * ct[0].paymentLimitPercent) / 100), 'списали больше лимита');
  assert(f.due === b1.total - (50000 - card.balance), 'finance долг не уменьшился на бонусы');
});

await step('P8', 'Остаток — наличными во вкладке «Оплата» (finance): визит оплачен, в журнале и финансах одна цифра', async () => {
  const s = await FA.payBookingQuick(BIZ, b1.id, 'cash');
  const ex = await JA.getBookingExtras(b1.id);
  const status = await FA.getBookingPaymentStatus(BIZ, b1.id);
  note(`finance due ${s.due}; journal paid ${ex.paidAmount} (визит ${b1.total}); статус ${JSON.stringify(status).slice(0, 120)}`);
  assert(s.due === 0, 'finance: остался долг');
});

await step('P9', 'Скидка по акции + вторая скидка на визит запрещена (одна скидка)', async () => {
  const promos = await LA.listApplicablePromotions(BIZ, b3.clientId, visitOf(b3));
  note(`применимые акции: ${promos.map((p) => `${p.name}:${p.discountAmount ?? p.amount ?? JSON.stringify(p).slice(0, 80)}`).join('; ')}`);
  const p = promos[0];
  assert(p, 'нет применимой акции для карты «Постоянный гость»');
  const amount = Math.round(b3.total * 0.1);
  await pay(b3, [{ kind: 'promo', amount, promotionId: p.id ?? p.promotionId, cardId: 'lc_qa3' }]);
  const f = await fin(b3);
  note(`скидка ${amount}; finance due ${f.due} (визит ${b3.total})`);
  assert(f.due === b3.total - amount, 'finance не учёл скидку');
  let second = 'прошла';
  try { await pay(b3, [{ kind: 'promo', amount, promotionId: p.id ?? p.promotionId, cardId: 'lc_qa3' }]); } catch (e) { second = 'отказ ' + e.message; }
  note('вторая скидка: ' + second);
  assert(second.startsWith('отказ'), 'вторая скидка на визит прошла');
});

await step('P10', 'Скидка акции без ограничения суммы: движок не даёт скидку больше визита', async () => {
  let r = 'прошла';
  try {
    await pay(b5, [{ kind: 'promo', amount: b5.total * 3, promotionId: Lz().promotions.find((x) => x.businessId === BIZ).id }]);
    const ex = await JA.getBookingExtras(b5.id);
    const f = await fin(b5);
    r = `прошла: journal paid ${ex.paidAmount} при визите ${b5.total}; finance due ${f.due}`;
  } catch (e) { r = 'отказ ' + e.message; }
  note(r);
  await LA.cancelVisitPayments({ businessId: BIZ, locationId: b5.locationId, bookingId: b5.id, clientId: b5.clientId, visit: visitOf(b5) }).catch(() => {});
  assert(!/paid (\d+)/.test(r) || Number(r.match(/paid (\d+)/)[1]) <= b5.total, 'скидка больше суммы визита записана в платежи');
});

await step('P11', 'Абонемент на чужую услугу к визиту не применяется', async () => {
  const s = await LA.getLoyaltyBookingSummary(BIZ, b5.clientId, visitOf(b5));
  const m = s.memberships.find((x) => x.id === 'lm_qa_other');
  note(`абонемент: ${m ? `applicable=${m.applicable} cover=${m.coverAmount}` : 'не показан'}`);
  let r = 'прошла';
  try { await pay(b5, [{ kind: 'membership', amount: b5.total, membershipId: 'lm_qa_other' }]); } catch (e) { r = 'отказ ' + e.message; }
  note('оплата: ' + r);
  assert(r.startsWith('отказ'), 'чужой абонемент списал посещение');
});

await step('P12', 'Личный счёт: в пределах баланса (и минуса типа), остаток — долг', async () => {
  let r;
  try {
    await pay(b2, [{ kind: 'account', amount: b2.total, accountId: 'lacc_qa' }]);
    const a = Lz().accounts.find((x) => x.id === 'lacc_qa');
    const f = await fin(b2);
    r = `счёт 3000 → ${a.balance}; finance due ${f.due} (визит ${b2.total})`;
    note(r);
    const lim = accT.allowNegative ? accT.negativeLimit : 0;
    assert(a.balance >= -lim, 'ушли в минус сверх лимита');
    assert(f.due === b2.total - (3000 - a.balance), 'finance не учёл списание со счёта');
  } catch (e) { throw e; }
});

await step('P13', 'Кэшбэк: оплата деньгами → начисление по акции карты; отмена оплаты снимает начисление', async () => {
  const prev = await LA.previewCashback(BIZ, b4.clientId, visitOf(b4), b4.total);
  note(`превью: ${JSON.stringify(prev).slice(0, 150)}`);
  await FA.payBookingQuick(BIZ, b4.id, 'cash');
  const ex = await JA.getBookingExtras(b4.id);
  const payments = await LA.visitPaymentsForCashback(BIZ, b4.id, ex.payments ?? []);
  await LA.syncBookingCashback(BIZ, b4.locationId, b4.clientId, b4.id, payments, visitOf(b4));
  const card = Lz().cards.find((c) => c.id === 'lc_qa4');
  const acc = Lz().transactions.filter((x) => x.bookingId === b4.id && x.type === 'loyaltyAccrual');
  note(`карта 0 → ${card.balance}; начисления ${acc.map((x) => x.amount).join(',')}`);
  assert(card.balance > 0, 'кэшбэк не начислен');
  const s = await FA.getBookingPaymentSummary(BIZ, b4.id);
  const line = s.payments.find((p) => !p.cancelled);
  await FA.removeBookingPaymentLine(BIZ, line.id);
  const ex2 = await JA.getBookingExtras(b4.id);
  await LA.syncBookingCashback(BIZ, b4.locationId, b4.clientId, b4.id, await LA.visitPaymentsForCashback(BIZ, b4.id, ex2.payments ?? []), visitOf(b4));
  const card2 = Lz().cards.find((c) => c.id === 'lc_qa4');
  note(`после отмены оплаты карта ${card2.balance}`);
  assert(card2.balance === 0, 'кэшбэк не снят');
});

await step('P14', 'Вкладка «Оплата» (finance): оплата с личного счёта списывает счёт лояльности и помнит визит', async () => {
  // так делает useLoyaltyBridge: chargeAccount(businessId, accountId, amount, staffId, undefined) + payBookingFromClientAccount
  const before = Lz().accounts.find((x) => x.id === 'lacc_qa7').balance;
  const updated = await LA.chargeAccount(BIZ, 'lacc_qa7', b7.total, undefined, undefined);
  await FA.payBookingFromClientAccount(BIZ, b7.id, b7.clientId, b7.total, { accountId: 'lacc_qa7', debt: updated.balance < 0 });
  const f = await fin(b7);
  const tx = Lz().transactions.filter((x) => x.accountId === 'lacc_qa7' && x.type === 'accountCharge' && x.amount < 0);
  const rows = await LA.listTransactions(BIZ, {});
  const row = rows.find((r) => r.id === tx[0]?.id);
  note(`счёт ${before} → ${updated.balance}; finance due ${f.due}; транзакция bookingId=${tx[0]?.bookingId ?? '—'}; строка в «Транзакциях»: ${row ? JSON.stringify(row).slice(0, 200) : '—'}`);
  assert(f.due === 0, 'finance не видит оплату со счёта');
  assert(tx[0]?.bookingId === b7.id, 'списание со счёта из вкладки «Оплата» не привязано к визиту (useLoyaltyBridge передаёт bookingId=undefined)');
});

await step('P15', 'Лояльность в «Сколько стоит лояльность» и транзакциях после оплат', async () => {
  const rows = await LA.listTransactions(BIZ, {});
  const ours = rows.filter((r) => [b1, b2, b3, b4, b6, b7].some((b) => r.bookingId === b.id));
  note(`строк по нашим визитам: ${ours.length}; виды ${[...new Set(ours.map((r) => r.type))].join(',')}`);
  const cost = await LA.getLoyaltyCostReport(BIZ);
  note(`стоимость: ${JSON.stringify(cost).slice(0, 250)}`);
  assert(ours.length > 0, 'транзакции не видны');
});

await step('P16', 'Отмена пополнения счёта: транзакция пополнения тоже уходит из «Транзакций»', async () => {
  const r = await LA.topupAccount(BIZ, 'lacc_qa7', 1000);
  const n1 = Lz().transactions.filter((x) => x.accountId === 'lacc_qa7' && x.amount === 1000).length;
  await LA.cancelAccountTopup(BIZ, 'lacc_qa7', r.operationId);
  const n2 = Lz().transactions.filter((x) => x.accountId === 'lacc_qa7' && x.amount === 1000).length;
  note(`транзакций +1000 до отмены ${n1}, после ${n2}`);
  assert(n2 < n1, 'отменённое пополнение осталось в транзакциях лояльности (+1000 ֏ «висит» в отчёте)');
});

await step('P17', 'Отмена оплаты абонементом возвращает статус «Выдан» / владельца (подаренный абонемент)', async () => {
  mutate((L) => { const m = L.memberships.find((x) => x.id === 'lm_qa'); m.status = 'issued'; });
  await pay(b1.id === b1.id ? { ...b1, id: B[8]?.id ?? b1.id, total: B[8]?.total ?? b1.total, services: B[8]?.services ?? b1.services, clientId: B[8]?.clientId ?? b1.clientId } : b1, [{ kind: 'membership', amount: 1, membershipId: 'lm_qa' }]).catch((e) => note('оплата: ' + e.message));
  const m = Lz().memberships.find((x) => x.id === 'lm_qa');
  note(`после оплаты другим клиентом: владелец ${m.clientId === b1.clientId ? 'прежний' : 'сменился'}, статус ${m.status}`);
  if (B[8]) await LA.cancelVisitPayments({ businessId: BIZ, locationId: B[8].locationId, bookingId: B[8].id, clientId: B[8].clientId, visit: visitOf(B[8]) });
  const m2 = Lz().memberships.find((x) => x.id === 'lm_qa');
  note(`после отмены: владелец ${m2.clientId === b1.clientId ? 'прежний' : 'остался новый'}, статус ${m2.status}, посещений ${m2.balanceVisits}`);
  assert(m2.clientId === b1.clientId, 'после отмены оплаты абонемент остался у заплатившего, а не вернулся владельцу');
});

console.log(`\nИтог: ${results.filter((r) => r.status === 'pass').length}/${results.length}`);
(await import('node:fs')).writeFileSync(root + '/qa/full-test-0930/loyalty/engine-results.json', JSON.stringify(results, null, 1));
console.warn = origWarn;
process.exit(0);
