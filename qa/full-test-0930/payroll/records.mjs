// F-09-039/040: 500 за запись + 100 за услугу; запись мастера администратору не засчитывается
import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
const D = await jiti.import(root + '/src/domain/payroll.ts');
const mk = (id, by, n, loc = 'L') => ({ id, createdBy: by, createdAt: '2026-09-24T10:00', locationId: loc, start: '2026-09-25T10:00', status: 'arrived', services: Array.from({ length: n }, () => ({ serviceId: 's', price: 1000, qty: 1, staffId: 'M' })) });
const block = { enabled: true, perRecordAmount: 500, perServicePayout: { unit: 'amount', value: 0 }, perServiceOverrides: [], onlineWidgetEnabled: false, onlineWidgetPayout: { unit: 'amount', value: 0 } };
const ten = Array.from({ length: 10 }, (_, i) => mk('b' + i, 'ADM', 1));
console.log('10 записей × 500 =', D.recordsRewardForDay([...ten, mk('m', 'MASTER', 1)], 'ADM', '2026-09-25', block, [], 'L'), '(ожидается 5000)');
console.log('3 услуги × 100 =', D.recordsRewardForDay([mk('x', 'ADM', 3)], 'ADM', '2026-09-25', { ...block, perRecordAmount: 0, perServicePayout: { unit: 'amount', value: 100 } }, [], 'L'), '(ожидается 300)');
console.log('запись другого филиала =', D.recordsRewardForDay([mk('y', 'ADM', 1, 'L2')], 'ADM', '2026-09-25', block, [], 'L'), '(ожидается 0)');
// Решение владельца 01.10: отмена клиентом / неявка / будущая запись — не оплачиваются
for (const st of ['cancelled_by_client', 'no_show', 'scheduled']) console.log(st, '=', D.recordsRewardForDay([{ ...mk('z', 'ADM', 2), status: st }], 'ADM', '2026-09-25', block, [], 'L'), '(ожидается 0)');
// Решение 01.10 (уточнено): начисляется днём визита, а не днём создания
console.log('день создания 24.09 =', D.recordsRewardForDay([{ ...mk('w', 'ADM', 1), status: 'arrived' }], 'ADM', '2026-09-24', block, [], 'L'), '(ожидается 0); день визита 25.09 =', D.recordsRewardForDay([{ ...mk('w', 'ADM', 1), status: 'arrived' }], 'ADM', '2026-09-25', block, [], 'L'), '(ожидается 500)');
