// G: услуги мастеру → «Опубликовать»; en; причины «не видно клиентам»; ранняя отмена оплаченной → refundDue
import { start, log, book } from './h.mjs';
const h = await start({ device: 'desktop' });
const p = h.page;
const dump = async (tag, n = 900) => log(tag, (await h.text()).slice(0, n).replace(/\n+/g, ' | '));
const main = async (tag, n = 1200) => log(tag, (await p.locator('main').innerText().catch(() => '')).slice(0, n).replace(/\n+/g, ' | '));
const step = async (name, fn) => { try { await fn(); } catch (e) { log('FAIL', name, e.message.split('\n')[0]); await h.shot('G-fail-' + name); } };
const iso = (d) => { const q = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`; };
await step('refund', async () => {
  await h.setDevice('phone');
  // Эрик: срок бесплатной отмены 3 ч, запись через 3 дня → отмена раньше срока
  const d = new Date(Date.now() + 3 * 86400000); while (((d.getDay() + 6) % 7) === 1) d.setDate(d.getDate() + 1);
  const r = await book(h, { slug: 'kaytsak-barbershop', s: 'sv_kay_cut', m: 'st_kaytsak_erik', date: iso(d), phone: '91110009', name: 'Жанна Вернуть' });
  log('G1 booking', r.id, r.created[0]?.status, JSON.stringify(r.created[0]?.prepayment));
  await p.getByRole('button', { name: 'Я оплатил' }).click(); await h.settle(800);
  await h.setDevice('desktop');
  await h.go('/biz/online/requests?sphere=barber', 'owner');
  await p.getByRole('button', { name: 'Деньги пришли' }).first().click(); await h.settle(1000);
  await h.setDevice('phone');
  await p.goto(r.url); await h.settle(1200);
  await p.getByRole('button', { name: 'Отменить', exact: true }).click(); await h.settle(500);
  log('G1 dialog:', (await p.getByRole('dialog', { name: 'Отменить запись?' }).innerText()).replace(/\n+/g, ' | '));
  await p.getByRole('button', { name: 'Да, отменить' }).click(); await h.settle(1000);
  const db = await h.db();
  const b = db.core.bookings.find((x) => x.id === r.id);
  log('G1 db', b.status, b.cancelledLate, JSON.stringify(b.prepayment), 'noShow', db.core.clients.find((c) => c.id === b.clientId)?.noShowCount);
  await h.setDevice('desktop');
  await h.go(`/biz/journal?booking=${r.id}&sphere=barber`, 'owner'); await h.shot('G1-journal-refund');
  log('G1 journal refund:', ((await h.text()).match(/[^\n]*(Верн|вернул)[^\n]*/gi) || []).slice(0, 5).join(' | '));
});
await step('hidden', async () => {
  await h.setDevice('desktop');
  await h.go('/biz/online/settings?sphere=barber', 'owner'); await h.shot('G2-settings-hidden', true);
  log('G2 hidden badges', await p.getByText('Не видно клиентам').count());
  await h.go('/b/individual-x', 'guest');
});
await step('slotpicker', async () => {
  await h.setDevice('desktop');
  await h.go('/b/kaytsak-barbershop/book?s=sv_kay_cut&m=st_kaytsak_david&step=time&d=' + iso(new Date(Date.now() + 86400000)), 'guest');
  await h.shot('G7-empty-day-desktop');
});
log('errors', h.errors.slice(0, 10).map((e) => e.slice(0, 200)));
await h.end();
