// I: (1) «Другое время» → взять окно → исходная «Перенесена на …» у клиента и в журнале; (2) confirmDeadline после «Деньги пришли»
import { start, log, book } from './h.mjs';
const h = await start();
const p = h.page;
const dump = async (tag, n = 700) => log(tag, (await h.text()).slice(0, n).replace(/\n+/g, ' | '));
const iso = (d) => { const q = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`; };
const nextDay = (wd) => { const d = new Date(Date.now() + 86400000); while (((d.getDay() + 6) % 7) !== wd) d.setDate(d.getDate() + 1); return iso(d); };
const nowLocal = (shiftMin) => { const d = new Date(Date.now() + shiftMin * 60000); const q = (n) => String(n).padStart(2, '0'); return `${iso(d)}T${q(d.getHours())}:${q(d.getMinutes())}`; };
const day = nextDay(1);
try {
  const r = await book(h, { slug: 'atam-dental', s: 'sv_atam_consult', m: 'st_atam_ashot', date: day, phone: '91110031', name: 'Инна Перенос', slotIndex: 6 });
  log('I1 created', r.id, r.created[0]?.status);
  await h.setDevice('desktop');
  await h.go('/biz/online/requests?sphere=dental', 'owner');
  const card = p.locator('div', { hasText: 'Инна Перенос' }).filter({ has: p.getByRole('button', { name: 'Другое время' }) }).last();
  await card.getByRole('button', { name: 'Другое время' }).click(); await h.settle(800);
  const sheet = p.locator('[role="dialog"]').last();
  await sheet.locator('button[aria-pressed]').first().click();
  await sheet.getByRole('button', { name: /Отправить/ }).last().click(); await h.settle(800);
  await h.setDevice('phone');
  await p.goto(r.url); await h.settle(1000);
  await p.locator('[data-f~="F-00-067"] button').first().click();
  await p.waitForURL((u) => !u.toString().includes(r.id), { timeout: 60000 }).catch(() => {});
  await h.settle(1000);
  let db = await h.db();
  const orig = db.core.bookings.find((x) => x.id === r.id);
  log('I1 original', orig.status, orig.cancelReason, orig.rescheduledTo, 'late', orig.cancelledLate);
  await p.goto(r.url); await h.settle(1000);
  await h.shot('I1-original-client', true); await dump('I1 original page:');
  await h.setDevice('desktop');
  await h.go(`/biz/journal?booking=${r.id}&sphere=dental`, 'owner'); await h.settle(1500);
  await h.shot('I1-journal-window');
  log('I1 journal:', ((await h.text()).match(/[^\n]*Перенесена[^\n]*/g) || ['нет']).join(' | '));

  // (2) мастер «с подтверждением» + предоплата → «Деньги пришли» спустя 3 ч после заявки
  // Карен (персона master в стоматологии) сам ставит «С подтверждением» и предоплату 20 %
  await h.go('/biz/online/settings?sphere=dental', 'master');
  await dump('I2 settings:', 300);
  await p.getByRole('radio', { name: 'С подтверждением' }).or(p.getByRole('button', { name: 'С подтверждением' })).first().click();
  await p.getByText('Брать предоплату за онлайн-запись').first().click(); await p.waitForTimeout(300);
  await p.getByText('20%', { exact: true }).first().click();
  await p.getByPlaceholder('Idram · +374 …').fill('Idram · +374 91 000000');
  await p.getByRole('button', { name: 'Сохранить' }).first().click(); await h.settle(1000);
  const karen = (await h.db()).core.staff.find((x) => x.id === 'st_atam_karen');
  log('I2 karen', karen?.confirmMode, JSON.stringify(karen?.prepayment));
  const r2 = await book(h, { slug: 'atam-dental', s: 'sv_atam_consult', m: 'st_atam_karen', date: nextDay(2), phone: '91110022', name: 'Карина Срок', slotIndex: 5 });
  log('I2 created', r2.id, r2.created[0]?.status, JSON.stringify(r2.created[0]?.prepayment));
  await p.getByRole('button', { name: 'Я оплатил' }).click(); await h.settle(800);
  await h.patch('const x = db.core.bookings.find((b) => b.id === arg.id); x.createdAt = arg.past;', { id: r2.id, past: nowLocal(-180) });
  await h.setDevice('desktop');
  await h.go('/biz/online/requests?sphere=dental', 'owner');
  const c2 = p.locator('div', { hasText: 'Карина Срок' }).filter({ has: p.getByRole('button', { name: 'Деньги пришли' }) }).last();
  await c2.getByRole('button', { name: 'Деньги пришли' }).click(); await h.settle(1000);
  db = await h.db();
  let b2 = db.core.bookings.find((x) => x.id === r2.id);
  log('I2 after money', b2.status, 'createdAt', b2.createdAt, 'deadline', b2.confirmDeadline);
  await h.go('/biz/journal?sphere=dental', 'owner'); await h.settle(1500);
  await h.go('/biz/online/requests?sphere=dental', 'owner');
  db = await h.db();
  b2 = db.core.bookings.find((x) => x.id === r2.id);
  log('I2 after reload', b2.status, b2.cancelReason ?? '-', 'in requests:', (await h.text()).includes('Карина Срок'));
} catch (e) { log('FAIL', e.message.split('\n')[0]); await h.shot('I-fail', true); }
log('errors', h.errors.slice(0, 6).map((e) => e.slice(0, 200)));
await h.end();
