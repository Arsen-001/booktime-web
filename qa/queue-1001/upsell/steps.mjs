// Шаги сценария допродажи — каждый принимает открытую страницу (мок живёт в localStorage одного браузера)
import { BASE, settle } from './lib.mjs';
const T = (lang, ru, en) => (lang === 'ru' ? ru : en);

export async function setRelated(s) {
  const { page, lang, mode } = s;
  const q = mode === 'mock' ? `?demo=owner&sphere=nails&lang=${lang}&data=mock` : `?lang=${lang}&data=api`;
  await page.goto(`${BASE}/biz/services/sv_nuri_gel${q}`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  const title = T(lang, 'Сопутствующие услуги и товары', 'Add-on services and products');
  const section = page.locator('section', { hasText: title }).first();
  await section.scrollIntoViewIfNeeded();
  const pick = async (placeholder, text) => {
    const box = section.getByPlaceholder(placeholder);
    await box.click();
    await box.fill(text);
    await page.waitForTimeout(500);
    await page.getByRole('option', { name: new RegExp(text) }).first().click();
    await page.waitForTimeout(300);
  };
  const has = async (txt) => (await section.innerText()).includes(txt);
  if (!(await has(T(lang, 'Дизайн ногтей', 'Nail art')))) await pick(T(lang, 'Добавить услугу', 'Add a service'), T(lang, 'Дизайн', 'Nail art'));
  if (!(await has(T(lang, 'Снятие покрытия', 'Polish removal')))) await pick(T(lang, 'Добавить услугу', 'Add a service'), T(lang, 'Снятие', 'Polish removal'));
  if (!(await has('Топовое'))) await pick(T(lang, 'Добавить товар', 'Add a product'), 'Топовое');
  await section.scrollIntoViewIfNeeded();
  await s.shot('1-related-picked');
  const save = page.getByRole('button', { name: T(lang, 'Сохранить', 'Save') }).last();
  if (await save.isEnabled()) {
    await save.click();
    await settle(page, 1500);
  }
  return (await section.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400);
}

export async function widgetBook(s, phone) {
  const { page, lang, mode, device } = s;
  const r = {};
  const q = mode === 'mock' ? `&demo=guest&lang=${lang}&data=mock` : `&lang=${lang}&data=api`;
  await page.goto(`${BASE}/b/nuri-nail-studio/book?s=sv_nuri_gel&m=st_nuri_sona&step=time${q}`, { waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  const slot = page.getByRole('button', { name: /^\d{1,2}:\d{2}/ }).first();
  await slot.waitFor({ timeout: 15000 });
  await slot.click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: T(lang, 'Продолжить', 'Continue') }).last().click();
  await settle(page, 2500);
  const heading = page.getByRole('heading', { name: T(lang, 'Добавить к визиту', 'Add to your visit') });
  await heading.waitFor({ timeout: 15000 });
  const block = page.locator('[data-f="F-03-090"]', { has: heading });
  await block.scrollIntoViewIfNeeded();
  await s.shot('2-widget-offers');
  r.offers = (await block.innerText()).replace(/\s+/g, ' ');
  await block.locator('li', { hasText: T(lang, 'Дизайн ногтей', 'Nail art') }).getByRole('button').click();
  await page.waitForTimeout(1500);
  await block.locator('li', { hasText: 'Топовое' }).getByRole('button').click();
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await s.shot('3-widget-added', device === 'phone');
  r.summary = (await page.locator('[data-f="F-03-090"]').first().innerText()).replace(/\s+/g, ' ');
  r.bookingDate = new URL(page.url()).searchParams.get('d');
  await page.getByPlaceholder(T(lang, 'Введите имя', 'Enter your name')).fill(T(lang, 'Тест Допродажа', 'Upsell Test'));
  await page.locator('input[type=tel]').first().fill(phone.replace('+374', ''));
  await page.getByRole('button', { name: T(lang, 'Получить код', 'Get code') }).click();
  await page.waitForTimeout(1800);
  if (mode === 'api') {
    const boxes = page.locator('input[inputmode=numeric], input[autocomplete="one-time-code"]');
    await boxes.first().click();
    await page.keyboard.type('0000', { delay: 80 });
    await page.waitForTimeout(1200);
  }
  await page.getByText(T(lang, 'Согласен на обработку персональных данных', 'I agree to personal-data processing')).click().catch(async () => {
    await page.getByRole('checkbox').last().check({ force: true });
  });
  await page.getByRole('button', { name: T(lang, /^Записаться/, /^Book/) }).last().click();
  await page.waitForURL(/\/booking\//, { timeout: 20000 });
  await settle(page, 2500);
  r.url = page.url();
  await s.shot('4-widget-confirmed', true);
  r.confirmed = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 900);
  return r;
}

/** Журнал: открыть запись — в составе визита услуга + сопутствующая + товар; «Предложить клиенту»; «Оплатить» — сумма с товаром */
export async function journalCheck(s, bookingUrl, pay = true) {
  const { page, lang, mode } = s;
  const r = {};
  const id = bookingUrl.match(/booking\/([^?]+)/)[1];
  const q = mode === 'mock' ? `&demo=owner&sphere=nails&lang=${lang}&data=mock` : `&lang=${lang}&data=api`;
  const date = (r.date = s.bookingDate);
  await page.goto(`${BASE}/biz/journal?booking=${id}${date ? `&date=${date}` : ''}${q}`, { waitUntil: 'domcontentloaded' });
  await settle(page, 3500);
  const dialog = page.getByRole('dialog').last();
  await dialog.waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  r.window = (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 1200);
  await s.shot('5-journal-window');
  const quick = dialog.getByText(T(lang, 'Предложить клиенту', 'Suggest to the client'));
  r.quickAdd = await quick.isVisible().catch(() => false);
  if (r.quickAdd) {
    await quick.scrollIntoViewIfNeeded();
    await s.shot('6-journal-quickadd');
  }
  if (pay) {
    const payBtn = dialog.getByRole('button', { name: T(lang, 'Оплатить', 'Pay'), exact: true }).first();
    await payBtn.scrollIntoViewIfNeeded();
    await payBtn.click();
    await settle(page, 2000);
    r.payment = (await page.getByRole('dialog').last().innerText()).replace(/\s+/g, ' ').slice(0, 1200);
    await s.shot('7-journal-payment');
  }
  return r;
}

/** Приложение клиента: /book у Соны → время → «Добавить к визиту»: Снятие покрытия + товар → «Подтвердить запись» */
export async function clientBook(s, staffId = 'st_nuri_sona') {
  const { page, lang, mode, device } = s;
  const r = {};
  const q = mode === 'mock' ? `&demo=client&lang=${lang}&data=mock` : `&lang=${lang}&data=api`;
  await page.goto(`${BASE}/book?staff=${staffId}&service=sv_nuri_gel${q}`, { waitUntil: 'domcontentloaded' });
  await settle(page, 3000);
  const cont = page.getByRole('button', { name: T(lang, 'Продолжить запись', 'Continue booking') });
  if (await cont.isVisible().catch(() => false)) { await cont.click(); await page.waitForTimeout(800); }
  // второе окно дня — чтобы не совпасть с только что созданной записью виджета
  const slots = page.getByRole('button', { name: /^\d{1,2}:\d{2}/ });
  await slots.first().waitFor({ timeout: 15000 });
  const pickSlot = (await slots.count()) > 2 ? slots.nth(2) : slots.first();
  await pickSlot.scrollIntoViewIfNeeded().catch(() => {});
  await pickSlot.click({ force: true });
  await settle(page, 2500);
  const heading = page.getByRole('heading', { name: T(lang, 'Добавить к визиту', 'Add to your visit') });
  await heading.waitFor({ timeout: 15000 });
  const card = page.locator('[data-f="F-00-092"]', { has: heading }).last();
  await card.scrollIntoViewIfNeeded();
  await s.shot('8-client-offers');
  r.offers = (await card.innerText()).replace(/\s+/g, ' ');
  const first = card.locator('li').first();
  await first.getByRole('button').click();
  await page.waitForTimeout(1200);
  if (!(await first.innerText()).includes('Топовое')) await card.locator('li', { hasText: 'Топовое' }).getByRole('button').click().catch(() => {});
  await page.waitForTimeout(800);
  await s.shot('9-client-added', device === 'phone');
  r.bar = (await page.locator('body').innerText()).match(/(Маникюр с покрытием[^\n]*\+ \d[^\n]*|Gel[^\n]*\+ \d[^\n]*)/)?.[0];
  await page.getByRole('button', { name: T(lang, 'Подтвердить запись', 'Confirm booking') }).last().click();
  await settle(page, 3000);
  await s.shot('10-client-done', true);
  r.done = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 500);
  return r;
}
