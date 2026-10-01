// A: предоплата процентом → «вся сумма» → «Я оплатил» → мастер «Деньги пришли» → отмена до срока → «Верните клиенту»
import { start, log, book } from './h.mjs';
const h = await start();
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
try {
  const r = await book(h, { slug: 'kaytsak-barbershop', s: 'sv_kay_cut', m: 'st_kaytsak_erik', date: tomorrow, full: true, shotPrefix: 'A1' , phone: '91110001', name: 'Анна Предоплата'});
  log('A1 url', r.url, 'picked', r.picked);
  log('A1 prepay text:', (r.detailsText.match(/Мастер берёт[^\n]*|Только предоплату[^\n]*|Всю сумму[^\n]*|Остальное[^\n]*|Куда платить[^\n]*|Переведите[^\n]*/g) || []).join(' | '));
  for (const b of r.created) log('A1 created', b.id, b.status, JSON.stringify(b.prepayment), b.start, b.source);
  const bk = r.created[0];
  await h.shot('A2-confirmed-awaiting-pay', true);
  log('A2 page:', (await h.text()).slice(0, 900).replace(/\n+/g, ' | '));
  // «Я оплатил»
  await h.page.getByRole('button', { name: 'Я оплатил' }).click();
  await h.settle(800);
  await h.shot('A3-after-ipaid');
  log('A3 page:', (await h.text()).slice(0, 500).replace(/\n+/g, ' | '));
  let db = await h.db();
  const bookingUrl = h.page.url();
  log('A3 db', db.core.bookings.find((b) => b.id === bk.id).status, JSON.stringify(db.core.bookings.find((b) => b.id === bk.id).prepayment), db.areas.online.bookingMeta[bk.id]?.prepaymentReportedAt);
  // Мастер/владелец: журнал
  await h.setDevice('desktop');
  await h.go(`/biz/journal?date=${tomorrow}&sphere=barber`, 'owner');
  await h.shot('A4-journal-owner');
  const jt = await h.text();
  log('A4 journal mentions:', /Деньги пришли|оплат/i.test(jt), (jt.match(/[^\n]*(Анна Предоплата|оплат|Требует внимания|заявк)[^\n]*/gi) || []).slice(0, 12).join(' | '));
  await h.go(`/biz/online/requests?sphere=barber`, 'owner');
  await h.shot('A5-requests-owner');
  log('A5 requests:', (await h.text()).slice(0, 1500).replace(/\n+/g, ' | '));
  const money = h.page.getByRole('button', { name: 'Деньги пришли' });
  log('A5 money buttons', await money.count());
  if (await money.count()) { await money.first().click(); await h.settle(800); }
  db = await h.db();
  log('A5 db after money', db.core.bookings.find((b) => b.id === bk.id).status, JSON.stringify(db.core.bookings.find((b) => b.id === bk.id).prepayment));
  // Клиент видит «Вы записаны», отменяет до срока
  await h.setDevice('phone');
  await h.page.goto(bookingUrl); await h.settle(800);
  await h.shot('A6-client-confirmed', true);
  log('A6 page:', (await h.text()).slice(0, 1200).replace(/\n+/g, ' | '));
  await h.page.getByRole('button', { name: 'Отменить', exact: true }).click();
  await h.settle(500);
  await h.shot('A7-cancel-dialog');
  log('A7 dialog:', (await h.page.locator('[role="dialog"]').innerText()).replace(/\n+/g, ' | '));
  await h.page.getByRole('button', { name: 'Да, отменить' }).click();
  await h.settle(800);
  await h.shot('A8-after-cancel', true);
  log('A8 page:', (await h.text()).slice(0, 600).replace(/\n+/g, ' | '));
  db = await h.db();
  const after = db.core.bookings.find((b) => b.id === bk.id);
  log('A8 db', after.status, JSON.stringify(after.prepayment), after.cancelledLate);
  await h.setDevice('desktop');
  await h.go(`/biz/journal?date=${tomorrow}&sphere=barber`, 'owner');
  const jt2 = await h.text();
  log('A9 journal refund:', (jt2.match(/[^\n]*(Верн|возвр)[^\n]*/gi) || []).slice(0, 8).join(' | '));
  await h.shot('A9-journal-refund');
  log('errors', h.errors.slice(0, 10));
} catch (e) { log('FAIL', e.message); await h.shot('A-fail', true); log('errors', h.errors.slice(0, 10)); }
finally { await h.end(); }
