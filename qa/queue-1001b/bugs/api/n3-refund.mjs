// №3 (api): запись с предоплатой → «Я оплатил» → «Деньги пришли» → клиент отменяет вовремя → в «Требует внимания»
// (тот же запрос, что AttentionPanel: отменённые с from=-60 дней) есть строка «Верните клиенту»
import { login, ok } from './lib.mjs';
const BIZ = 'biz_nuri', STAFF = process.env.STAFF ?? 'st_nuri_ani';
const owner = await login('+37400110001', 'business');
const client = await login(process.env.PHONE ?? '+37400990030', 'client', 'Тест Клиент');
ok(owner.status === 200 && client.status === 200, `вход владельца ${owner.status}, клиента ${client.status}`);
const card = await client.call('GET', `/v1/public/masters/${STAFF}`);
const service = card.json.slotService ?? card.json.services?.[0];
const day = new Date(Date.now() + 5 * 86400000 + 4 * 3600000).toISOString().slice(0, 10);
const slots = await client.call('GET', `/v1/public/masters/${STAFF}/slots?date=${day}&serviceId=${service.id}`);
const slot = (Array.isArray(slots.json) ? slots.json : slots.json.slots ?? [])[0];
ok(Boolean(slot), `окно ${day}: ${slot?.start}`);
const made = await client.call('POST', '/v1/me/bookings', { staffId: STAFF, serviceId: service.id, start: slot.start, payInFull: true });
const bk = made.json.booking ?? made.json;
ok(made.status < 300, `запись ${made.status} ${bk.id} ${bk.status} ${JSON.stringify(bk.prepayment)}`);
const paid = await client.call('POST', `/v1/me/bookings/${bk.id}/paid`);
ok(paid.status < 300, `«Я оплатил» ${paid.status}`);
const recv = await owner.call('POST', `/v1/biz/${BIZ}/bookings/${bk.id}/prepayment-received`, {});
ok(recv.status < 300, `«Деньги пришли» ${recv.status} ${JSON.stringify(recv.json.prepayment ?? recv.json).slice(0, 160)}`);
const cancel = await client.call('POST', `/v1/me/bookings/${bk.id}/cancel`);
ok(cancel.status < 300 && cancel.json.late === false, `отмена клиентом ${cancel.status}, поздно: ${cancel.json.late}, предоплата: ${JSON.stringify(cancel.json.booking?.prepayment)}`);
const from = new Date(Date.now() - 60 * 86400000 + 4 * 3600000).toISOString().slice(0, 10);
const list = await owner.call('GET', `/v1/biz/${BIZ}/bookings?statuses=cancelled_by_client,cancelled_by_master,no_show&from=${from}`);
const refunds = (list.json ?? []).filter((b) => b.prepayment?.paid && (b.prepayment.refundDue ?? 0) > 0 && !b.prepayment.refundedAt);
ok(refunds.some((b) => b.id === bk.id), `«Вернуть предоплату»: строк ${refunds.length}, наша есть: ${refunds.some((b) => b.id === bk.id)}`);
console.log('BOOKING', bk.id);
