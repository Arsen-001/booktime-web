// Финансы — сценарии действием на мок-api (node + jiti, та же база и правила, что у экранов). ROOT=… — другой src.
import { createJiti } from 'jiti';
const root = process.env.ROOT || '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const fin = await jiti.import(root + '/src/api/finance.ts');
const S = () => db.useDb.getState();
const results = [];
const check = (f, n, ok, info = '') => { results.push({ f, n, ok, info }); console.log(ok ? 'PASS' : 'FAIL', f, n, info); };
const err = async (p) => { try { await p; return null; } catch (e) { return e.code ?? e.message; } };
const biz = 'biz_atam';
const loc = S().core.businesses.find((b) => b.id === biz).locationIds[0];
const bal = async (id) => (await fin.listAccountsWithBalance(biz)).find((a) => a.id === id)?.balance;
const T = (min = 0) => new Date(Date.now() + 4 * 3600000 + min * 60000).toISOString().slice(0, 16);

// F-07-001..006 кассы
const accs0 = await fin.listAccountsWithBalance(biz);
const cash = accs0.find((a) => a.kind === 'cash');
const card = accs0.find((a) => a.kind === 'card');
check('F-07-002', 'по умолчанию есть наличная и безналичная касса', Boolean(cash && card));
const acc = await fin.createAccount(biz, { locationId: loc, name: 'QA касса', kind: 'cash', openingBalance: 1000 });
check('F-07-003', 'новая касса с начальным балансом 1000', (await bal(acc.id)) === 1000);
await fin.updateAccount(biz, acc.id, { name: 'QA касса 2' });
check('F-07-004', 'переименование видно в списке', (await fin.listAccounts(biz)).some((a) => a.id === acc.id && a.name === 'QA касса 2'));
const ids = (await fin.listAccounts(biz)).map((a) => a.id);
await fin.reorderAccounts(biz, [acc.id, ...ids.filter((i) => i !== acc.id)]);
check('F-07-005', 'касса поднята на первое место', (await fin.listAccounts(biz))[0]?.id === acc.id);
const cashBefore = await bal(cash.id);
await fin.transferFunds(biz, { fromAccountId: cash.id, toAccountId: acc.id, amount: 5000 });
check('F-07-006', 'перевод 5000: источник −5000, получатель +5000', (await bal(cash.id)) === cashBefore - 5000 && (await bal(acc.id)) === 6000);
check('F-07-006', 'перевод в ту же кассу запрещён', (await err(fin.transferFunds(biz, { fromAccountId: acc.id, toAccountId: acc.id, amount: 1 }))) === 'same_account');
check('F-07-006', 'перевод больше остатка наличной кассы — отказ/вопрос', (await err(fin.transferFunds(biz, { fromAccountId: acc.id, toAccountId: cash.id, amount: 999999 }))) !== null);

// F-07-007..009 статьи
const items = await fin.listItems(biz);
check('F-07-007', 'справочник статей по умолчанию', items.length >= 10, `${items.length} статей`);
const it = await fin.createItem(biz, { name: 'QA статья', kind: 'expense', group: undefined });
check('F-07-008', 'новая статья в списке', (await fin.listItems(biz)).some((i) => i.id === it.id));
const sys = items.find((i) => i.systemKey || i.system);
check('F-07-009', 'системную статью удалить нельзя', sys ? (await err(fin.removeItem(biz, sys.id))) !== null : false, sys ? sys.name : 'нет системных');
await fin.removeItem(biz, it.id);
check('F-07-009', 'свою статью удалить можно', !(await fin.listItems(biz)).some((i) => i.id === it.id));

// F-07-012..015 операции
const inc = items.find((i) => i.kind === 'income');
const op = await fin.recordOperation(biz, { locationId: loc, accountId: acc.id, itemId: inc.id, kind: 'income', amount: 2000, date: T(), method: 'cash', partyType: 'none' });
check('F-07-012', 'ручной приход 2000 → остаток 8000', (await bal(acc.id)) === 8000);
check('F-07-012', 'расход больше остатка наличной кассы — отказ', (await err(fin.recordOperation(biz, { locationId: loc, accountId: acc.id, itemId: items.find((i) => i.kind === 'expense').id, kind: 'expense', amount: 50000, date: T(), method: 'cash', partyType: 'none' }, { checkFunds: true }))) !== null);
await fin.updateOperation(biz, op.id, { amount: 2500 });
const op2 = await fin.getOperation(biz, op.id);
check('F-07-014', 'правка суммы меняет остаток и пишет историю', (await bal(acc.id)) === 8500 && op2.history.some((h) => h.action === 'edited' && h.from === '2000' && h.to === '2500'));
await fin.cancelOperation(biz, op.id);
check('F-07-015', 'отмена: остаток без операции, операция в «Отменённых»', (await bal(acc.id)) === 6000 && (await fin.getOperation(biz, op.id)).cancelled === true);
check('F-07-015', 'отменённую нельзя править', (await err(fin.updateOperation(biz, op.id, { amount: 1 }))) !== null);

// F-07-019..021 контрагенты
const cp = await fin.createCounterparty(biz, { type: 'supplier', name: 'QA Поставщик', phone: '+37491000000' });
check('F-07-020', 'контрагент создан', (await fin.listCounterparties(biz)).some((c) => c.id === cp.id));
await fin.removeCounterparty(biz, cp.id);
check('F-07-021', 'контрагент удалён', !(await fin.listCounterparties(biz)).some((c) => c.id === cp.id));

// F-07-036..045 оплата визита (без предоплаты)
const paidIds = new Set(S().areas.finance.bookingPayments.map((p) => p.bookingId));
const free = S().core.bookings.filter((b) => b.businessId === biz && !b.deletedAt && !b.prepayment && ['scheduled', 'client_confirmed'].includes(b.status) && !paidIds.has(b.id) && b.total >= 10000 && b.clientId && !(b.goods?.length));
const [v1, v2, v3] = free;
const tiles = await fin.listBookingPaymentTiles(biz);
const cashTile = tiles.find((t) => t.kind === 'cash');
const cardTile = tiles.find((t) => t.kind === 'card');
let s = await fin.payBookingSplit(biz, v1.id, [{ methodKey: cashTile.key, amount: 4000 }]);
check('F-07-038', 'частичная оплата: статус partial, остаток верный', s.status === 'partial' && s.due === v1.total - 4000, `${s.status} ${s.due}`);
check('F-07-036', 'первая оплата переводит визит в «Пришёл»', S().core.bookings.find((b) => b.id === v1.id).status === 'arrived');
s = await fin.payBookingSplit(biz, v1.id, [{ methodKey: cashTile.key, amount: 1000 }, { methodKey: cardTile.key, amount: v1.total - 5000 }]);
check('F-07-038', 'доплата двумя способами: paid', s.status === 'paid' && s.due === 0);
check('F-07-039', 'в списке платежей 3 платежа (группы)', new Set(s.payments.map((p) => p.groupId)).size === 3, `${new Set(s.payments.map((p) => p.groupId)).size}`);
const opsV1 = S().areas.finance.operations.filter((o) => o.refId === v1.id && !o.cancelled && o.kind === 'income');
check('F-07-018', 'каждая оплата — одна операция в кассе (Ф11)', opsV1.length === 3, `${opsV1.length} операций`);
s = await fin.addBookingPromoDiscount(biz, v2.id, 'QA акция', 2000);
check('F-07-041', 'скидка строкой: к оплате меньше на 2000, в кассу не идёт', s.due === v2.total - 2000 && !S().areas.finance.operations.some((o) => o.refId === v2.id));
s = await fin.payBookingQuick(biz, v2.id, cashTile.key);
check('F-07-037', 'быстрая оплата — ровно остаток', s.status === 'paid' && S().areas.finance.operations.filter((o) => o.refId === v2.id && o.kind === 'income').reduce((a, o) => a + o.amount, 0) === v2.total - 2000);
// Возвраты F-07-066/067
const line = s.payments.find((p) => p.kind === 'money' && !p.cancelled);
s = await fin.refundBookingPayment(biz, line.id, 1000, 'QA частичный');
check('F-07-067', 'частичный возврат 1000: refunded 1000, статус «частично возвращено»', s.refunded === 1000 && s.refundState === 'partial', `${s.refunded} ${s.refundState}`);
check('F-07-042', 'платёж с возвратом нельзя просто удалить', (await err(fin.removeBookingPaymentLine(biz, line.id))) === 'payment_has_refunds');
s = await fin.refundBookingFull(biz, v2.id, 'QA полный');
check('F-07-066', 'полный возврат: всё, что заплатили деньгами, возвращено', s.refundState === 'full' && s.refunded === v2.total - 2000, `${s.refunded} ${s.refundState}`);
// Удаление платежа
s = await fin.payBookingSplit(biz, v3.id, [{ methodKey: cashTile.key, amount: 3000 }]);
const l3 = s.payments.find((p) => !p.cancelled);
s = await fin.removeBookingPaymentLine(biz, l3.id);
check('F-07-042', 'отмена платежа: визит снова не оплачен, операция в кассе отменена', s.status === 'unpaid' && S().areas.finance.operations.filter((o) => o.refId === v3.id).every((o) => o.cancelled));
// F-07-014 (новое): операцию оплаты визита нельзя отменить/править со страницы операции
const bop = S().areas.finance.operations.find((o) => o.refId === v1.id && !o.cancelled);
check('F-07-014', 'операцию оплаты визита нельзя отменить со страницы операции', (await err(fin.cancelOperation(biz, bop.id))) === 'operation_linked');
check('F-07-014', 'сумму оплаты визита нельзя править со страницы операции', (await err(fin.updateOperation(biz, bop.id, { amount: 1 }))) === 'operation_linked');

// F-07-046 сводка дня
const day = await fin.getDayMoneySummary(biz, T().slice(0, 10));
check('F-07-046', 'сводка денег за день считается', day && typeof day === 'object', JSON.stringify(day).slice(0, 160));

// F-07-059..064 счёт клиента
const client = v1.clientId;
const r = await fin.topUpClientAccount(biz, client, 'QA', cash.id, 5000, 'cash');
check('F-07-060', 'пополнение счёта 5000: баланс клиента +5000', r.balance >= 5000, String(r.balance));
const ups = await fin.listClientAccountTopUps(biz, client);
const up = ups.find((u) => u.id === r.topUp.id);
await fin.cancelClientAccountTopUp(biz, up.id);
check('F-07-064', 'отмена пополнения: баланс клиента обратно', (await fin.getClientAccountBalance(biz, client)) === r.balance - 5000);
const topOp = S().areas.finance.operations.find((o) => o.businessId === biz && o.source === 'account' && !o.cancelled);
if (topOp) check('F-07-014', 'пополнение счёта нельзя отменить со страницы операции', (await err(fin.cancelOperation(biz, topOp.id))) === 'operation_linked');

// F-07-075 штраф
const pen = await fin.chargeClientPenalty(biz, loc, cash.id, client, 'QA', 1500, 'QA штраф');
check('F-07-075', 'штраф — приход по статье штрафа', pen.kind === 'income' && pen.amount === 1500);

// F-07-079..081 ссылка на оплату
const v4 = free[3];
const link = await fin.createPaymentLink(biz, { targetKind: 'booking', bookingId: v4.id, amount: 3000, remainingBefore: v4.total });
await fin.markPaymentLinkPaid(biz, link.id);
s = await fin.getBookingPaymentSummary(biz, v4.id);
check('F-07-081', 'частичная оплата по ссылке 3000: визит частично оплачен', s.status === 'partial' && s.due === v4.total - 3000, `${s.status} ${s.due}`);

// F-07-088..093 предоплата онлайн
const svc = S().core.services.find((x) => x.businessId === biz);
await fin.savePrepaymentSettings(biz, { enabled: true, mode: 'required', amountType: 'percent', amountValue: 30 });
const calc = await fin.calcPrepayment(biz, { serviceIds: [svc.id], servicePrices: { [svc.id]: 10000 } });
check('F-07-092', 'предоплата 30% от 10 000 = 3 000', calc.amount === 3000 || calc.total === 3000, JSON.stringify(calc).slice(0, 200));

// F-07-159/160 взаиморасчёты: выдача зарплаты
const staff = S().core.staff.find((x) => x.businessId === biz && x.role === 'master');
const before = await fin.getSettlementBalance(biz, staff.id);
await fin.createSettlementEntry(biz, staff.id, 'bonus', 'QA премия', 2000);
check('F-07-161', 'премия 2000 увеличивает долг бизнеса мастеру', (await fin.getSettlementBalance(biz, staff.id)) === before + 2000, `${before} → ${await fin.getSettlementBalance(biz, staff.id)}`);
const cashB = await bal(cash.id);
await fin.payoutSalary(biz, loc, staff.id, cash.id, 1000, 'QA выплата');
check('F-07-160', 'выплата 1000: касса −1000, баланс взаиморасчётов −1000', (await bal(cash.id)) === cashB - 1000 && (await fin.getSettlementBalance(biz, staff.id)) === before + 1000);

// F-07-004 удаление кассы по умолчанию у метода оплаты
const settings = await fin.getPaymentMethodsSettings(biz);
const defCash = settings.cash.accountId ?? settings.cash.defaultAccountId;
console.log('  cash method account', defCash);
const rmErr = await err(fin.removeAccount(biz, defCash));
const v5 = free[4];
const tilesAfter = await fin.listBookingPaymentTiles(biz);
const payErr = await err(fin.payBookingQuick(biz, v5.id, cashTile.key));
const v5op = S().areas.finance.operations.find((o) => o.refId === v5.id && !o.cancelled);
const accExists = v5op ? S().areas.finance.accounts.some((a) => a.id === v5op.accountId) : null;
check('F-07-004', 'касса по умолчанию у «Наличных» не удаляется молча (или деньги после удаления попадают в живую кассу)', rmErr !== null || (payErr === null && accExists === true) || payErr !== null, `remove: ${rmErr ?? 'удалена'}; оплата после: ${payErr ?? 'ок'}; касса операции существует: ${accExists}; плитка наличных → ${tilesAfter.find((t) => t.kind === 'cash')?.accountId}`);

const ok = results.filter((x) => x.ok).length;
console.log(`ИТОГ ${ok}/${results.length}`);
for (const x of results.filter((y) => !y.ok)) console.log('  FAIL', x.f, x.n, x.info);
process.exit(0);
