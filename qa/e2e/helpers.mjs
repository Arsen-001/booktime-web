// Общие шаги цепочек: запись клиентом, поиск записи в базе, открытие записи в журнале.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Fail, ROOT, addDays, today } from './lib.mjs';

/** Подписи статусов берём из словаря в момент прогона — их правят параллельно */
function statusLabels() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'messages/ru/common.json'), 'utf8')).bookingStatus ?? {};
  } catch {
    return {};
  }
}

export const CLIENT_APP_USER = 'au_01'; // персона client = первый пользователь приложения (src/demo/context.ts)

/** Подпись дня в полосе дат шага «Время» (/book) */
function dayRegex(date) {
  if (date === today()) return /Сегодня/;
  if (date === addDays(today(), 1)) return /Завтра/;
  const dd = String(Number(date.slice(8, 10)));
  return new RegExp(`(^|\\D)${dd}(\\D|$)`);
}

/**
 * Клиент записывается через /book (F-00-092): услуга → время → (оттенок) → подтверждение.
 * opts: { staffId, service (название), date?, time?, shade?, forWhom?, slotFromCard? }
 * Возвращает созданную запись из базы.
 */
export async function clientBook(t, opts) {
  const before = await t.db();
  const knownIds = new Set(before.core.bookings.map((b) => b.id));
  await t.go('client', `/book?staff=${opts.staffId}`, 'phone');
  const txt = await t.text();
  const radios = t.page.getByRole('radio');
  if (txt.includes('Шаг') && (await radios.count())) {
    if (opts.service) await t.click(`text=${opts.service}`);
    else await radios.first().click();
    await t.click('role=button[name="Продолжить"]');
  }
  // шаг «Время»
  if (opts.date) {
    const day = t.page.locator('button.min-w-16', { hasText: dayRegex(opts.date) }).first();
    if (!(await day.count())) throw new Fail(`в шаге «Время» нет дня ${opts.date} (нет окон у мастера)`);
    await day.click();
    await t.settle(200);
  }
  else {
    const firstDay = t.page.locator('button.min-w-16').first();
    if (await firstDay.count()) {
      await firstDay.click();
      await t.settle(200);
    }
  }
  const slotButtons = t.page.locator('button.min-h-11');
  await slotButtons.first().waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
  let slot = opts.time ? slotButtons.filter({ hasText: new RegExp(`^\\s*${opts.time}\\s*$`) }).first() : slotButtons.first();
  if (!(await slot.count())) {
    if (opts.time) throw new Fail(`в шаге «Время» нет окна ${opts.time} на ${opts.date ?? 'первый день'}`);
    throw new Fail('в шаге «Время» нет ни одного окна');
  }
  const pickedTime = (await slot.innerText()).trim();
  await slot.click();
  await t.settle(300);
  // шаг «Оттенок»
  if (await t.has('Оттенок или вариант')) {
    if (opts.shade) await t.click(`text=${opts.shade}`);
    const cont = t.page.getByRole('button', { name: 'Продолжить' });
    if (await cont.count()) await cont.first().click();
    await t.settle(300);
  }
  if (opts.forWhom === 'child') {
    await t.click('text=Ребёнок');
    await t.fill('input[placeholder="Как зовут"]', opts.visitorName ?? 'Мгер');
  }
  await t.click('role=button[name="Подтвердить запись"]', { after: 1200 });
  const after = await t.db();
  const created = after.core.bookings.filter((b) => !knownIds.has(b.id));
  if (!created.length) {
    const toasts = await t.toasts();
    throw new Fail(`запись не создалась${toasts.length ? ` (тост: «${toasts.join(' / ')}»)` : ''}`);
  }
  const booking = created[created.length - 1];
  return { booking, pickedTime, db: after };
}

/** Клиент из CRM бизнеса по номеру телефона (ключ — телефон, F-00-128) */
export function crmClientByPhone(db, businessId, phone) {
  return db.core.clients.find((c) => c.businessId === businessId && c.phone === phone);
}

export function bookingById(db, id) {
  return db.core.bookings.find((b) => b.id === id);
}

export function hm(dt) {
  return dt.slice(11, 16);
}

/** Открыть запись в журнале (окно записи) от лица персоны кабинета */
export async function openInJournal(t, persona, booking, extra = '') {
  await t.go(persona, `/biz/journal?date=${booking.start.slice(0, 10)}&booking=${booking.id}${extra}`, 'desktop');
  const dlg = t.page.locator('[role="dialog"]');
  if (!(await dlg.count())) throw new Fail('окно записи не открылось по ссылке ?booking=');
  await dlg.first().locator('[data-f~="F-01-054"], select').first().waitFor({ timeout: 15000 }).catch(() => {});
  await t.settle(200);
  return dlg.first();
}

/** Сменить статус записи в окне журнала и сохранить */
export async function setStatusInJournal(t, persona, booking, status, extra = '') {
  const dlg = await openInJournal(t, persona, booking, extra);
  // Новое окно (F-01-054): кнопки/чипы статуса с подписью из common.bookingStatus; старое — select по значению
  let picked;
  const label = statusLabels()[status];
  const zone = dlg.locator('[data-f~="F-01-054"]');
  if (label && (await zone.count())) {
    const btn = zone.locator('button', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).first();
    if (await btn.count()) {
      await btn.click();
      picked = label;
    }
  }
  const selects = dlg.locator('select');
  for (let i = 0; !picked && i < (await selects.count()); i++) {
    const opts = await selects.nth(i).evaluate((s) => [...s.options].map((o) => ({ v: o.value, l: o.text })));
    const hit = opts.find((o) => o.v === status);
    if (hit) {
      await selects.nth(i).selectOption(hit.v);
      picked = hit.l;
    }
  }
  if (!picked) throw new Fail(`в окне записи нет статуса «${status}» в списке`);
  await dlg.getByRole('button', { name: /^Сохранить/ }).last().click();
  await t.settle(400);
  // Вне графика / пересечение — второй диалог с подтверждением
  const dialogs = t.page.locator('[role="dialog"], [role="alertdialog"]');
  const confirmTexts = [];
  if ((await dialogs.count()) > 1) {
    const top = dialogs.last();
    confirmTexts.push((await top.innerText()).replace(/\n+/g, ' · ').slice(0, 160));
    const btns = top.getByRole('button');
    await btns.last().click();
    await t.settle(400);
  }
  let toasts = await t.toasts();
  // Обязательные доп. поля на «Пришёл» (F-01-066): окно раскрывает «Расширенные поля» с «Обязательное поле» —
  // заполняем (дата — первый доступный день календаря) и сохраняем ещё раз
  const req = dlg.locator('text=Обязательное поле');
  if ((await dlg.count()) && (await req.count())) {
    confirmTexts.push(`обязательные доп. поля: ${await req.count()} (тост «${toasts.join(' / ')}»)`);
    for (let i = 0; i < (await req.count()); i++) {
      // подпись поля «…*» стоит перед контролом; «Обязательное поле» — после
      const ctrl = req.nth(i).locator('xpath=preceding::*[self::button or self::input or self::select][1]');
      const tag = await ctrl.evaluate((e) => e.tagName.toLowerCase()).catch(() => '');
      if (tag === 'select') await ctrl.selectOption({ index: 1 }).catch(() => {});
      else if (tag === 'input') await ctrl.fill('e2e').catch(() => {});
      else if (tag === 'button') {
        await ctrl.click().catch(() => {});
        await t.settle(300);
        // календарь всплывашки — последний [role=grid] на странице (первый — мини-календарь журнала под окном)
        const day = t.page.locator('[role="grid"]').last().locator('button:not([disabled])').nth(10);
        await day.click().catch(async () => day.dispatchEvent('click').catch(() => {}));
        await t.settle(300);
      }
    }
    // тост ошибки ложится поверх кнопки «Сохранить» в подвале окна — жмём кнопку напрямую
    await dlg.getByRole('button', { name: /^Сохранить/ }).last().dispatchEvent('click').catch(() => {});
    await t.settle(800);
    toasts = await t.toasts();
  }
  const db = await t.db();
  const updated = bookingById(db, booking.id);
  updated.__ui = { confirm: confirmTexts, toasts };
  return updated;
}

/** Текст блока записи в сетке журнала по времени начала «HH:MM–» и колонке мастера */
export async function journalBlockText(t, booking) {
  const start = hm(booking.start);
  const blocks = t.page.locator('[data-testid="booking-block"]', { hasText: `${start}–` });
  return blocks.allInnerTexts();
}

/** Свободные времена мастера на дату в потоке записи клиента (/book → услуга → день) */
export async function freeTimes(t, staffId, date, serviceName) {
  await t.go('client', `/book?staff=${staffId}`);
  const radios = t.page.getByRole('radio');
  if (await radios.count()) {
    if (serviceName) await t.click(`text=${serviceName}`);
    else await radios.first().click();
    await t.click('role=button[name="Продолжить"]');
  }
  await t.page.locator('button.min-w-16').first().waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
  const day = t.page.locator('button.min-w-16', { hasText: dayRegex(date) }).first();
  if (!(await day.count())) return [];
  await day.click();
  await t.settle(300);
  return (await t.page.locator('button.min-h-11').allInnerTexts()).map((x) => x.trim());
}

/** «Клиенты» кабинета: поиск по имени/телефону, текст результата */
export async function clientsSearch(t, persona, query, extra = '') {
  await t.go(persona, `/biz/clients${extra ? `?${extra.replace(/^&/, '')}` : ''}`, 'desktop');
  // q4: подсказка поля сменилась на «Имя, телефон, email или номер карты» — берём любое из известных
  const input = t.page.locator('main input[placeholder^="Имя, телефон"], main input[placeholder^="Поиск (по имени"], main input[type="search"]').filter({ visible: true }).first();
  await input.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {
    throw new Fail('в «Клиентах» нет поля поиска');
  });
  await input.fill(query);
  const btn = t.page.getByRole('button', { name: /^Найти/ }).first();
  if (await btn.count()) await btn.click();
  else await input.press('Enter');
  await t.settle(600);
  return t.mainText();
}

/** PNG заданного размера одним цветом (для загрузок с проверкой «не меньше W×H» — сторис, баннеры). q3 */
export function solidPng(w, h, rgb = [180, 60, 120]) {
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) row.set(rgb, 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
