// №3 «Вернуть предоплату» после своевременной отмены клиентом (мок, jiti): запись с оплаченной предоплатой →
// клиент отменяет раньше срока → запрос «Требует внимания» (тот же, что в AttentionPanel) её находит
import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
console.warn = () => {}; console.error = () => {};
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const C = await jiti.import(root + '/src/api/core.ts');
const D = await jiti.import(root + '/src/lib/date.ts');
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) process.exitCode = 1; };
const st = () => db.useDb.getState();
const BIZ = 'biz_nuri';
const today = D.today();
const au = st().core.appUsers[0];
const b = st().core.bookings.find((x) => x.businessId === BIZ && !x.deletedAt && x.start.slice(0, 10) >= D.addDays(today, 3) && /^(scheduled|client_confirmed)$/.test(x.status));
await C.updateBooking(b.id, { appUserId: au.id, prepayment: { amount: 2000, paid: true } });
const res = await C.cancelBookingAsClient(b.id, au.id);
ok(!res.late, `отмена ${b.start} раньше срока: late=${res.late}`);
const after = st().core.bookings.find((x) => x.id === b.id);
ok(after.prepayment?.refundDue === 2000, `refundDue = ${after.prepayment?.refundDue}`);
const list = await C.listBookings({ businessIds: [BIZ], statuses: ['cancelled_by_client', 'cancelled_by_master', 'no_show'], from: D.addDays(today, -60) });
const refunds = list.filter((x) => x.prepayment?.paid && (x.prepayment.refundDue ?? 0) > 0 && !x.prepayment.refundedAt);
ok(refunds.some((x) => x.id === b.id), `в «Вернуть предоплату» ${refunds.length} строк(и), наша есть: ${refunds.some((x) => x.id === b.id)}`);
console.log('BOOKING', b.id, b.start, b.staffId);
