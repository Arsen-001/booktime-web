// B: мастер сам ставит 50% и срок возврата 48 ч → клиент записывается → оплатил → мастер «Деньги пришли» → поздняя отмена
//    (окно говорит «не вернётся» до нажатия) → запрет отмены оплаченных (prepaid_locked)
import { start, log, book } from './h.mjs';
const h = await start();
const p = h.page;
const iso = (d) => { const q = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`; };
const nextDay = (wd) => { const d = new Date(Date.now() + 86400000); while (((d.getDay() + 6) % 7) !== wd) d.setDate(d.getDate() + 1); return iso(d); };
const tomorrow = nextDay(4); // Давид работает вт, ср, пт, сб, вс
const DAVID = 'st_kaytsak_david';
const dump = async (tag, n = 900) => log(tag, (await h.text()).slice(0, n).replace(/\n+/g, ' | '));
try {
  // B1 мастер Давид: правила записи
  await h.go('/biz/online/settings?sphere=barber', 'master');
  await h.shot('B1-settings-master-phone', true);
  await dump('B1 settings:', 2500);
  const tog = p.getByText('Брать предоплату за онлайн-запись');
  await tog.first().click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: '50%' }).first().click().catch(async () => { await p.getByText('50%', { exact: true }).first().click(); });
  await p.getByPlaceholder('Idram · +374 …').fill('Idram · +374 99 123456');
  const custom = p.getByLabel('Своё число часов');
  log('B1 custom hours inputs', await custom.count());
  if (await custom.count()) { await custom.first().fill('48'); }
  await h.shot('B1-settings-filled', true);
  await p.getByRole('button', { name: 'Сохранить' }).first().click();
  await h.settle(800);
  let db = await h.db();
  const dv = db.core.staff.find((s) => s.id === DAVID);
  log('B1 saved staff', dv?.name, JSON.stringify(dv?.prepayment), JSON.stringify(db.areas.online.staffRules[DAVID]), JSON.stringify(dv?.bookingRules));
  // B2 клиент записывается к Давиду (только предоплата)
  const r = await book(h, { slug: 'kaytsak-barbershop', s: 'sv_kay_cut', m: DAVID, date: tomorrow, shotPrefix: 'B2', phone: '91110002', name: 'Борис Поздний' });
  log('B2 prepay text:', (r.detailsText.match(/Мастер берёт[^\n]*|Только предоплату[^\n]*|Всю сумму[^\n]*|Остальное[^\n]*|Куда платить[^\n]*|Переведите[^\n]*/g) || []).join(' | '));
  const b = r.created[0];
  log('B2 created', b?.id, b?.status, JSON.stringify(b?.prepayment), b?.start);
  const bookingUrl = r.url;
  await p.getByRole('button', { name: 'Я оплатил' }).click(); await h.settle(600);
  // мастер: журнал — видно ли заявку «оплатил»
  await h.setDevice('desktop');
  await h.go(`/biz/journal?date=${tomorrow}&sphere=barber`, 'master');
  await h.shot('B3-journal-master', false);
  const jt = await h.text();
  log('B3 journal:', (jt.match(/[^\n]*(Борис|оплат|Деньги пришли|заявк|Требует)[^\n]*/gi) || []).slice(0, 12).join(' | '));
  const moneyJ = p.getByRole('button', { name: /Деньги пришли|Предоплата получена/ });
  log('B3 money buttons in journal', await moneyJ.count());
  if (await moneyJ.count()) { await moneyJ.first().click(); await h.settle(800); log('B3 clicked in journal'); }
  else {
    await h.go('/biz/online/requests?sphere=barber', 'master');
    const mr = p.getByRole('button', { name: 'Деньги пришли' });
    log('B3 money in requests', await mr.count());
    if (await mr.count()) { await mr.first().click(); await h.settle(800); }
  }
  db = await h.db();
  log('B3 db', db.core.bookings.find((x) => x.id === b.id)?.status, JSON.stringify(db.core.bookings.find((x) => x.id === b.id)?.prepayment));
  // B4 поздняя отмена (срок 48 ч, запись завтра)
  await h.setDevice('phone');
  await p.goto(bookingUrl); await h.settle(800);
  await h.shot('B4-client-page', true);
  await dump('B4 page:', 1500);
  const noShowBefore = db.core.clients.find((c) => c.id === b.clientId)?.noShowCount;
  await p.getByRole('button', { name: 'Отменить', exact: true }).click(); await h.settle(400);
  await h.shot('B4-cancel-dialog-late');
  log('B4 dialog:', (await p.locator('[role="dialog"]').innerText()).replace(/\n+/g, ' | '));
  await p.getByRole('button', { name: 'Да, отменить' }).click(); await h.settle(800);
  await h.shot('B4-after-late-cancel', true);
  await dump('B4 after:', 600);
  db = await h.db();
  const ab = db.core.bookings.find((x) => x.id === b.id);
  log('B4 db', ab.status, ab.cancelledLate, JSON.stringify(ab.prepayment), 'noShow', noShowBefore, '→', db.core.clients.find((c) => c.id === b.clientId)?.noShowCount);
  // B5 запрет отмены оплаченных
  await h.go('/biz/online/settings?sphere=barber', 'master');
  await p.getByText('Разрешить клиентам отменять предоплаченные записи онлайн').first().click();
  await p.getByRole('button', { name: 'Сохранить' }).first().click(); await h.settle(800);
  db = await h.db();
  log('B5 rules', JSON.stringify(db.areas.online.staffRules[DAVID]));
  const r2 = await book(h, { slug: 'kaytsak-barbershop', s: 'sv_kay_cut', m: DAVID, date: tomorrow, phone: '91110003', name: 'Вера Закрыто', slotIndex: 3 });
  const b2 = r2.created[0];
  log('B5 created', b2?.id, b2?.status);
  await p.getByRole('button', { name: 'Я оплатил' }).click(); await h.settle(600);
  await h.go('/biz/online/requests?sphere=barber', 'master');
  const mr2 = p.getByRole('button', { name: 'Деньги пришли' });
  if (await mr2.count()) { await mr2.first().click(); await h.settle(800); }
  await p.goto(r2.url); await h.settle(800);
  await dump('B5 page:', 1200);
  await p.getByRole('button', { name: 'Отменить', exact: true }).click(); await h.settle(400);
  await h.shot('B5-cancel-dialog-locked');
  log('B5 dialog:', (await p.locator('[role="dialog"]').innerText()).replace(/\n+/g, ' | '));
  await p.getByRole('button', { name: 'Да, отменить' }).click(); await h.settle(600);
  log('B5 toasts', await p.evaluate(() => [...document.querySelectorAll('[role="status"],[role="alert"],[data-sonner-toast]')].map((e) => e.innerText).join(' || ')));
  await h.shot('B5-after-locked-try');
  db = await h.db();
  log('B5 db', db.core.bookings.find((x) => x.id === b2.id)?.status);
  log('errors', h.errors.slice(0, 10));
} catch (e) { log('FAIL', e.message); await h.shot('B-fail', true); log('errors', h.errors.slice(0, 10)); }
finally { await h.end(); }
