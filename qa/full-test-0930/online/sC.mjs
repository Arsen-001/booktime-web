// C: истечение ожидания оплаты; мастер не ответил → 3 окна; «Другое время»; Telegram
import { start, log, book } from './h.mjs';
const h = await start();
const p = h.page;
const iso = (d) => { const q = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`; };
const nextDay = (wd) => { const d = new Date(Date.now() + 86400000); while (((d.getDay() + 6) % 7) !== wd) d.setDate(d.getDate() + 1); return iso(d); };
const tomorrow = iso(new Date(Date.now() + 86400000));
const dump = async (tag, n = 900) => log(tag, (await h.text()).slice(0, n).replace(/\n+/g, ' | '));
const nowLocal = (shiftMin) => { const d = new Date(Date.now() + shiftMin * 60000); const q = (n) => String(n).padStart(2, '0'); return `${iso(d)}T${q(d.getHours())}:${q(d.getMinutes())}`; };
try {
  // C1 истечение предоплаты (Эрик, 30%)
  const r = await book(h, { slug: 'kaytsak-barbershop', s: 'sv_kay_cut', m: 'st_kaytsak_erik', date: tomorrow, phone: '91110004', name: 'Гоар Просрочила', slotIndex: 5 });
  const b = r.created[0];
  log('C1 created', b?.id, b?.status, JSON.stringify(b?.prepayment));
  await h.patch('const x = db.core.bookings.find((b) => b.id === arg.id); x.prepayment.holdUntil = arg.past;', { id: b.id, past: nowLocal(-2) });
  await p.waitForTimeout(1500);
  await h.shot('C1-expired-before-reload', true);
  await dump('C1 page (after patch reload):', 900);
  let db = await h.db();
  const eb = db.core.bookings.find((x) => x.id === b.id);
  log('C1 db', eb.status, eb.cancelReason, JSON.stringify(eb.prepayment));
  // слот снова свободен?
  // C2 мастер не ответил вовремя (Ашот, стоматология, «с подтверждением»)
  const ashotDay = nextDay(1);
  const r2 = await book(h, { slug: 'atam-dental', s: 'sv_atam_consult', m: 'st_atam_ashot', date: ashotDay, phone: '91110005', name: 'Давит Ждёт', shotPrefix: 'C2' });
  const b2 = r2.created[0];
  log('C2 created', b2?.id, b2?.status, b2?.createdAt, b2?.confirmDeadline, b2?.start, r2.url);
  await dump('C2 page:', 600);
  await h.patch('const x = db.core.bookings.find((b) => b.id === arg.id); x.createdAt = arg.past; if (x.confirmDeadline) x.confirmDeadline = arg.past;', { id: b2.id, past: nowLocal(-180) });
  await p.waitForTimeout(1500);
  await h.shot('C2-no-answer', true);
  await dump('C2 after expiry:', 1200);
  db = await h.db();
  const nb = db.core.bookings.find((x) => x.id === b2.id);
  log('C2 db', nb.status, nb.cancelReason, JSON.stringify(nb.alternativeStarts));
  const alt = p.locator('[data-f~="F-00-067"] button, [data-f~="F-00-067"] a');
  log('C2 alt buttons', await alt.count(), (await alt.allInnerTexts()).join(' / '));
  if (await alt.count()) {
    const before = new Set(db.core.bookings.map((x) => x.id));
    await alt.first().click();
    await p.waitForURL((u) => !u.toString().includes(b2.id), { timeout: 60000 }).catch(() => {});
    await h.settle(1200);
    await h.shot('C2-rebooked-one-tap', true);
    await dump('C2 after one tap:', 700);
    db = await h.db();
    log('C2 rebooked', db.core.bookings.filter((x) => !before.has(x.id)).map((x) => `${x.id} ${x.status} ${x.start}`).join(', '), p.url());
  }
  // C3 «Другое время» от мастера
  const r3 = await book(h, { slug: 'atam-dental', s: 'sv_atam_consult', m: 'st_atam_ashot', date: ashotDay, phone: '91110006', name: 'Ева Другое', slotIndex: 4 });
  const b3 = r3.created[0];
  log('C3 created', b3?.id, b3?.status, b3?.start);
  await h.setDevice('desktop');
  await h.go('/biz/online/requests?sphere=dental', 'owner');
  await h.shot('C3-requests-owner');
  await dump('C3 requests:', 1500);
  const card = p.locator('div', { hasText: 'Ева Другое' }).filter({ has: p.getByRole('button', { name: 'Другое время' }) }).last();
  log('C3 card found', await card.count());
  await card.getByRole('button', { name: 'Другое время' }).click(); await h.settle(800);
  await h.shot('C3-other-time-sheet');
  const sheet = p.locator('[role="dialog"]').last();
  log('C3 sheet:', (await sheet.innerText()).replace(/\n+/g, ' | ').slice(0, 800));
  const opts = sheet.locator('button[aria-pressed], [role="checkbox"], label');
  log('C3 opts', await opts.count());
  for (let i = 0; i < Math.min(2, await opts.count()); i++) await opts.nth(i).click();
  const send = sheet.getByRole('button', { name: /Отправить|Предложить/ });
  log('C3 send buttons', await send.count());
  if (await send.count()) { await send.last().click(); await h.settle(800); }
  db = await h.db();
  const ob = db.core.bookings.find((x) => x.id === b3.id);
  log('C3 db', ob.status, JSON.stringify(ob.alternativeStarts));
  await h.setDevice('phone');
  await p.goto(r3.url); await h.settle(800);
  await h.shot('C3-client-offered', true);
  await dump('C3 client:', 900);
  // C3b клиент берёт предложенное окно одним нажатием — исходная заявка снимается, новая без второго подтверждения
  {
    const alt3 = p.locator('[data-f~="F-00-067"] button, [data-f~="F-00-067"] a');
    log('C3b alt buttons', await alt3.count(), (await alt3.allInnerTexts()).join(' / '));
    if (await alt3.count()) {
      const before = new Set((await h.db()).core.bookings.map((x) => x.id));
      await alt3.first().click();
      await p.waitForURL((u) => !u.toString().includes(b3.id), { timeout: 60000 }).catch(() => {});
      await h.settle(1200);
      await h.shot('C3b-new-booking', true);
      globalThis.newUrl = p.url();
      db = await h.db();
      log('C3b new', db.core.bookings.filter((x) => !before.has(x.id)).map((x) => `${x.id} ${x.status} ${x.start}`).join(', '));
      log('C3b original after rebook', db.core.bookings.find((x) => x.id === b3.id).status);
      await dump('C3b page:', 500);
      // у мастера в «Заявках» не должно остаться исходной заявки
      await h.setDevice('desktop');
      await h.go('/biz/online/requests?sphere=dental', 'owner');
      log('C3b requests has Ева:', (await h.text()).includes('Ева Другое'));
      await h.setDevice('phone');
      await p.goto(r3.url); await h.settle(800);
      await h.shot('C3b-original-after-rebook', true);
      await dump('C3b original page:', 500);
    }
  }
  // C4 Telegram — на активной новой записи
  if (globalThis.newUrl) { await p.goto(globalThis.newUrl); await h.settle(1000); }
  const tg = p.getByRole('button', { name: 'Подключить Telegram' });
  log('C4 tg button', await tg.count());
  if (await tg.count()) {
    await tg.click(); await h.settle(800);
    await h.shot('C4-telegram-linked', true);
    const txt = await h.text();
    log('C4 after:', /Подключено/.test(txt), (txt.match(/[^\n]*Telegram[^\n]*/g) || []).join(' | '));
    db = await h.db();
    log('C4 db telegramLinked', JSON.stringify(db.areas.client?.telegramLinked));
  }
  log('errors', h.errors.slice(0, 10));
} catch (e) { log('FAIL', e.message, e.stack?.split('\n')[1]); await h.shot('C-fail', true); log('errors', h.errors.slice(0, 10)); }
finally { await h.end(); }
