// №1 «Освободилось время»: окно короче услуги никому не предлагается; клиенту в ленту — время, услуга и кнопка (мок, jiti)
// node qa/queue-1001b/bugs/n1-engine.mjs
import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
console.warn = () => {};
const origErr = console.error; console.error = () => {};
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const RA = await jiti.import(root + '/src/api/resources.ts');
const CA = await jiti.import(root + '/src/api/client.ts');
const OA = await jiti.import(root + '/src/api/journal-offers.ts');
const st = () => db.useDb.getState();
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) process.exitCode = 1; };
const BIZ = 'biz_nuri';
const core = st().core;
const tomorrow = new Date(Date.now() + 86400000 + 4 * 3600000).toISOString().slice(0, 10);
const staff = core.staff.find((s) => s.businessId === BIZ && core.services.some((sv) => sv.durationMin >= 45 && (sv.staffIds?.includes(s.id) || s.serviceIds?.includes(sv.id))));
const s45 = core.services.find((sv) => sv.durationMin >= 45 && (sv.staffIds?.includes(staff.id) || staff.serviceIds?.includes(sv.id)));
console.log('мастер', staff.name, '· услуга', s45.name.ru, s45.durationMin, 'мин · день', tomorrow);
const entry = await RA.addToWaitlist({ businessId: BIZ, locationId: staff.locationIds[0], clientName: 'QA Ждёт 45', clientPhone: '+37499111045', serviceIds: [s45.id], staffIds: [staff.id], wishes: [{ date: tomorrow }] });
const t = (freeMin) => ({ businessId: BIZ, staffId: staff.id, serviceId: s45.id, date: tomorrow, time: '13:30', freeMin });
const p30 = await OA.previewSlotOffer([t(30)]);
ok(p30.counts.waitlist === 0, `окно 30 мин, услуга ${s45.durationMin} мин → получателей из листа: ${p30.counts.waitlist} (ждём 0)`);
const p60 = await OA.previewSlotOffer([t(Math.max(60, s45.durationMin))]);
ok(p60.counts.waitlist >= 1, `окно ${Math.max(60, s45.durationMin)} мин → получателей из листа: ${p60.counts.waitlist} (ждём ≥1)`);
// клиент приложения встал в лист → предложение окна → лента
const user = core.appUsers[0];
await CA.addToWaitlist({ appUserId: user.id, staffId: staff.id, serviceId: s45.id, date: tomorrow });
const res = await OA.offerSlots([t(Math.max(60, s45.durationMin))], ['waitlist']);
ok(res.sent >= 1, `отправлено: ${res.sent}`);
const feed = await CA.listNotifications(user.id);
const n = feed.find((x) => x.kind === 'waitlist_slot');
ok(Boolean(n), 'в ленте клиента есть «Освободилось время»');
ok(n?.params?.date === tomorrow && n?.params?.time === '13:30', `время окна в params: ${n?.params?.date} ${n?.params?.time}`);
ok(n?.service?.id === s45.id, `услуга в записи ленты: ${n?.service?.name?.ru}`);
ok(Boolean(n?.staff), 'мастер есть (кнопка «Записаться» рисуется при entry.staff)');
console.error = origErr;
