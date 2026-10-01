// Приоритет: предложение окна из журнала («Свободно сегодня» / «Найти окно») доходит до заявки /biz/waitlist?
import { start, stop, ctx, open, goto, shot, area } from './lib.mjs';
const log = (...a) => console.log(...a);
await start();
try {
  const c = await ctx({ time: '2026-09-30T10:00:00+04:00' });
  const p = await open(c, '/biz/waitlist');
  await shot(p, 's1-01-waitlist');
  await p.getByRole('button', { name: 'Создать заявку' }).first().click();
  await p.waitForTimeout(700);
  const dlg = p.locator('[role=dialog]').last();
  await dlg.locator('input').first().fill('QA Ожидание');
  await dlg.locator('input[type=tel], input[inputmode=tel]').first().fill('91000111');
  await dlg.getByText('Выберите услуги').click();
  await p.waitForTimeout(600);
  const pick = p.locator('[role=dialog]').last();
  await pick.locator('input').first().fill('Снятие');
  await p.waitForTimeout(400);
  await pick.getByText('Снятие покрытия', { exact: true }).first().click();
  await pick.getByRole('button', { name: 'Готово' }).click().catch(async () => { await pick.getByRole('button').last().click(); });
  await p.waitForTimeout(500);
  await shot(p, 's1-02-form');
  await p.locator('[role=dialog]').last().getByRole('button', { name: 'Создать заявку' }).click();
  await p.waitForTimeout(1500);
  await shot(p, 's1-03-created');
  let res = await area(p, 'resources');
  const st = res?.state ?? res;
  const mine = (st?.waitlist ?? []).find((w) => w.clientName === 'QA Ожидание');
  log('resources entry:', JSON.stringify(mine));
  if (!mine) throw new Error('entry not created');

  // Свободно сегодня
  await goto(p, '/biz/journal');
  const ft = p.getByRole('button', { name: /Свободно сегодня|Предложить окна/ }).first();
  log('freeToday button visible:', await ft.isVisible().catch(() => false));
  await ft.click();
  await p.waitForTimeout(2500);
  await shot(p, 's1-04-freetoday');
  const sheet = p.locator('[role=dialog]').last();
  log('FREE TODAY SHEET:\n' + (await sheet.innerText()).slice(0, 1500));
  const send = sheet.locator('[data-slot-offer-send]');
  if (await send.isEnabled().catch(() => false)) { await send.click(); await p.waitForTimeout(2000); }
  await shot(p, 's1-05-sent');
  res = await area(p, 'resources');
  log('resources.waitlistNotified for entry:', JSON.stringify((res?.state ?? res)?.waitlistNotified?.[mine.id] ?? null));
  const nt = await area(p, 'notify');
  const lg = Object.values((nt?.state ?? nt)?.log ?? {}).flat().filter((m) => String(m.contact).includes('91000111') || (m.text?.ru ?? '').includes('QA Ожидание'));
  log('notify log rows for QA client:', lg.length);
  const j = await area(p, 'journal');
  log('journal.slotOffers:', ((j?.state ?? j)?.slotOffers ?? []).slice(0, 3).map((o) => `${o.serviceId} ${o.time} r=${o.recipients}`).join(' | '));

  // Найти окно для «Снятие покрытия»
  await goto(p, '/biz/journal');
  await p.getByRole('button', { name: 'Найти окно' }).first().click();
  await p.waitForTimeout(1200);
  const fs = p.locator('[role=dialog]').last();
  await fs.locator('input').first().fill('Снятие').catch(() => {});
  await p.waitForTimeout(500);
  await fs.getByText('Снятие покрытия').first().click().catch((e) => log('pick service fail', e.message.slice(0, 100)));
  await p.waitForTimeout(1500);
  await shot(p, 's1-06-findslot');
  const offerBtn = p.getByRole('button', { name: /Предложить (это окно|все окна|окно)/ }).first();
  log('offer btn:', await offerBtn.isVisible().catch(() => false));
  if (await offerBtn.isVisible().catch(() => false)) {
    await offerBtn.click(); await p.waitForTimeout(2000);
    await shot(p, 's1-07-offer-preview');
    log('FIND SLOT OFFER:\n' + (await p.locator('[role=dialog]').last().innerText()).slice(0, 1200));
  }
  // Заявка на /biz/waitlist — видно ли «уведомлён»
  await goto(p, '/biz/waitlist');
  await p.getByText('Снятие покрытия').first().click();
  await p.waitForTimeout(800);
  await shot(p, 's1-08-entry-after');
  log('entry text after:', (await p.locator('li', { hasText: 'QA Ожидание' }).first().innerText().catch(() => '')).replace(/\n/g, ' | '));
  log('errors:', p.errors);
} finally { await stop(); }
