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
  log('G1 dialog:', (await p.locator('[role="dialog"]').innerText()).replace(/\n+/g, ' | '));
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
  await h.go('/biz/online/settings', 'owner'); await h.shot('G2-settings-hidden', true);
  log('G2 hidden badges', await p.getByText('Не видно клиентам').count());
  await h.go('/b/individual-x', 'guest');
});
await step('publish', async () => {
  await h.setDevice('desktop');
  await h.go('/biz/online?empty=1', 'individual');
  await h.go('/biz/services', 'individual');
  await p.getByText('Добавить из шаблона').first().click(); await h.settle(800);
  await p.getByText('Выбрать все').first().click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /Добавить выбранные/ }).click(); await h.settle(2000);
  // назначить мастера первой услуге: колонка «Мастера»
  const noStaff = p.getByRole('button', { name: /Нет мастеров/ }).or(p.getByText('Нет мастеров'));
  log('G3 no-staff cells', await noStaff.count());
  await noStaff.nth(1).click().catch((e) => log('G3 click', e.message.split('\n')[0])); await h.settle(600);
  await h.shot('G3-assign');
  const opt = p.getByRole('option', { name: /Артак/ }).or(p.getByRole('checkbox', { name: /Артак/ })).or(p.getByRole('menuitemcheckbox', { name: /Артак/ }));
  log('G3 options', await opt.count());
  if (await opt.count()) { await opt.first().click(); await h.settle(800); await p.keyboard.press('Escape'); await h.settle(800); }
  await main('G3 services after:', 400);
  await h.go('/biz/schedule', 'individual');
  await p.getByRole('button', { name: 'Задать неделю' }).first().click(); await h.settle(1000);
  await p.getByText('Каждый день').first().click().catch(() => {});
  await p.locator('[role="dialog"]').last().getByRole('button', { name: 'Сохранить', exact: true }).click(); await h.settle(1500);
  await h.go('/biz/online', 'individual'); await h.shot('G4-links-ready'); await main('G4 links:', 500);
  const pub = p.getByRole('button', { name: 'Опубликовать' });
  log('G4 publish enabled', (await pub.count()) ? await pub.isEnabled() : 'нет кнопки');
  if ((await pub.count()) && (await pub.isEnabled())) {
    await pub.click(); await h.settle(1500);
    await h.shot('G4-after-publish'); await main('G4 after publish:', 400);
    const bz = (await h.db()).core.businesses.find((b) => b.id === 'biz_empty_solo' || (b.status === 'active' && /empty/.test(b.id)));
    log('G4 business', bz?.id, bz?.status, bz?.slug);
    await h.setDevice('phone');
    await h.go(`/b/${bz?.slug ?? 'novyi-master'}`, 'guest'); await h.shot('G5-public-after-publish'); await dump('G5 public:', 400);
  }
  await h.setDevice('desktop');
  await h.go('/biz/online?empty=0', 'owner');
});
await step('en', async () => {
  await h.setDevice('phone');
  await h.go('/b/nuri-nail-studio/book', 'guest');
  await p.getByText('Eng', { exact: true }).first().click();
  await p.waitForFunction(() => /Services|Step 1/.test(document.body.innerText), null, { timeout: 90000 }).catch(() => {});
  await h.shot('G6-book-en'); await dump('G6 en:', 400);
  await p.getByText('Рус', { exact: true }).first().click(); await h.settle(3000);
});
await step('slotpicker', async () => {
  await h.setDevice('desktop');
  await h.go('/b/kaytsak-barbershop/book?s=sv_kay_cut&m=st_kaytsak_david&step=time&d=' + iso(new Date(Date.now() + 86400000)), 'guest');
  await h.shot('G7-empty-day-desktop');
});
log('errors', h.errors.slice(0, 10).map((e) => e.slice(0, 200)));
await h.end();
