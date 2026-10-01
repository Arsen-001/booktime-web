// Финальная проверка мок-режима действием (01.10.2026). node qa/full-test-0930/final-mock/actions.mjs [step,...]
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/final-mock/act';
const only = process.argv[2]?.split(',');
const results = [];
let lastPage = null;
const log = (...a) => console.log(...a);

const release = await acquireBrowserSlot();
const browser = await chromium.launch({ headless: true });

async function ctxPage({ persona = 'owner', lang = 'ru', device = 'desktop', extra = '' } = {}) {
  const ctx = await browser.newContext(
    device === 'phone'
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang }
      : { viewport: { width: 1440, height: 900 }, locale: lang },
  );
  const page = await ctx.newPage();
  lastPage = page;
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) errors.push(`${r.status()} ${r.url()}`); });
  const go = async (route, q = '') => {
    const sep = route.includes('?') ? '&' : '?';
    await page.goto(`${BASE}${route}${sep}demo=${persona}&empty=0&lang=${lang}&sphere=nails&theme=light${extra}${q}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(800);
  };
  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
  return { ctx, page, errors, go, shot };
}

async function step(name, fn) {
  if (only && !only.includes(name)) return;
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push({ name, ok: true, note, ms: Date.now() - t0 });
    log(`OK   ${name}: ${note ?? ''}`);
  } catch (e) {
    await lastPage?.screenshot({ path: `${OUT}/FAIL-${name}.png` }).catch(() => {});
    results.push({ name, ok: false, note: String(e).slice(0, 400), ms: Date.now() - t0 });
    log(`FAIL ${name}: ${String(e).slice(0, 400)}`);
  }
}

// 1. Пакет услуг: открытие формы, несохранённое → вопрос, ?api=error → ErrorState
await step('package', async () => {
  const { ctx, page, go, shot, errors } = await ctxPage();
  await go('/biz/resources/packages/new');
  await page.locator('main input').first().fill('Пакет QA');
  await shot('pkg-new');
  await page.getByRole('button', { name: /^Новый пакет$/ }).last().click();
  await page.waitForURL(/packages\/(?!new)[^/?]+/, { timeout: 60_000 });
  const href = new URL(page.url()).pathname;
  await page.getByRole('tab').first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
  await shot('pkg-form');
  // правка: название
  const nameInput = page.locator('main input').first();
  await nameInput.fill('Пакет QA правка');
  await page.waitForTimeout(300);
  // уход по ссылке «назад»
  await page.locator('a[href="/biz/resources/packages"]').first().click();
  const dlg = page.getByRole('alertdialog').or(page.getByRole('dialog'));
  await dlg.first().waitFor({ timeout: 5000 });
  await shot('pkg-unsaved-dialog');
  const dlgText = (await dlg.first().innerText()).replace(/\s+/g, ' ');
  await page.getByRole('button', { name: /Остаться/ }).click();
  await page.waitForTimeout(400);
  const stillHere = page.url().includes(href);
  // ?api=error
  await go(href, '&api=error');
  await page.waitForTimeout(3000);
  await shot('pkg-api-error');
  const body = await page.locator('main').innerText().catch(() => '');
  const hasErr = /Не удалось|Повторить|ошибк/i.test(body);
  await ctx.close();
  if (!stillHere) throw new Error('после «Остаться» ушли со страницы');
  if (!hasErr) throw new Error('нет ErrorState при api=error: ' + body.slice(0, 200));
  return `form ${href}; диалог: «${dlgText.slice(0, 80)}»; ErrorState есть; console errors: ${errors.length} ${errors.slice(0, 3).join(' | ')}`;
});

// 2. Карточка сотрудника: правка специализации → Сохранить → перезагрузка → значение осталось
await step('staff', async () => {
  const { ctx, page, go, shot, errors } = await ctxPage();
  await go('/biz/staff');
  await page.getByText('Ани Саргсян').first().click();
  await page.waitForURL(/\/biz\/staff\/[^/?]+/, { timeout: 60_000 });
  const href = new URL(page.url()).pathname;
  await page.waitForTimeout(1500);
  const specialty = page.getByLabel(/Специализация/).first();
  await specialty.waitFor({ timeout: 60_000 });
  const val = `QA-${Date.now() % 100000}`;
  await specialty.fill(val);
  await page.waitForTimeout(300);
  await shot('staff-dirty');
  await page.getByRole('button', { name: /^Сохранить/ }).last().click();
  await page.getByText('Изменения сохранены').first().waitFor({ timeout: 10_000 });
  await shot('staff-saved');
  await go(href);
  await page.waitForTimeout(1500);
  const after = await page.getByLabel(/Специализация/).first().inputValue();
  await ctx.close();
  if (after !== val) throw new Error(`после перезагрузки «${after}», ожидалось «${val}»`);
  return `${href}: сохранено и видно после перезагрузки; console errors: ${errors.length} ${errors.slice(0, 3).join(' | ')}`;
});

// 3. Журнал уведомлений: модалка сообщения
await step('notifylog', async () => {
  const { ctx, page, go, shot, errors } = await ctxPage();
  await go('/biz/notifications/log');
  await page.waitForTimeout(1500);
  await shot('notify-log');
  const row = page.locator('main table tbody tr, main [role="row"], main li button, main button[data-row]').first();
  await row.click();
  const dlg = page.getByRole('dialog');
  await dlg.first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(400);
  await shot('notify-log-modal');
  const txt = (await dlg.first().innerText()).replace(/\s+/g, ' ').slice(0, 160);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const open = await page.getByRole('dialog').count();
  // и кнопкой закрытия
  await row.click();
  await dlg.first().waitFor({ timeout: 8000 });
  await page.getByRole('dialog').getByRole('button', { name: /Закрыть/ }).first().click();
  await page.waitForTimeout(600);
  const open2 = await page.getByRole('dialog').count();
  await shot('notify-log-closed');
  await ctx.close();
  if (open || open2) throw new Error(`модалка не закрылась (esc:${open}, кнопка:${open2})`);
  return `модалка: «${txt}»; errors: ${errors.length} ${errors.slice(0, 3).join(' | ')}`;
});

// 4. Лист ожидания → журнал ?waitlist= → сохранить → заявка закрыта
await step('waitlist', async () => {
  const { ctx, page, go, shot, errors } = await ctxPage();
  await go('/biz/waitlist');
  await page.waitForTimeout(1500);
  await shot('wl-before');
  const closedCount = async () => Number((await page.locator('main').innerText()).match(/Закрытая\s*(\d+)/)?.[1] ?? 0);
  const before = await closedCount();
  const entryTitle = 'Маникюр с покрытием гель-лаком';
  await page.getByText(entryTitle).first().click();
  await page.getByRole('button', { name: /^Записать$/ }).first().click();
  await page.waitForURL(/waitlist=/, { timeout: 30_000 });
  const url = page.url();
  await page.waitForTimeout(2500);
  await shot('wl-journal-window');
  const save = page.getByRole('button', { name: /^(Сохранить|Записать|Создать запись)$/ }).last();
  await save.click();
  await page.waitForTimeout(2500);
  await shot('wl-after-save');
  await go('/biz/waitlist');
  await page.waitForTimeout(1500);
  await shot('wl-after');
  const after = await closedCount();
  await ctx.close();
  if (after <= before) throw new Error(`закрытых не прибавилось (${before} → ${after}); url ${url}`);
  return `заявка «${entryTitle}»: закрытых ${before} → ${after}; errors: ${errors.length} ${errors.slice(0, 3).join(' | ')}`;
});

// 5. 12 ч: Системные → 12 → журнал и клиент AM/PM
await step('hour12', async () => {
  const { ctx, page, go, shot, errors } = await ctxPage();
  await go('/biz/settings/system');
  await page.waitForTimeout(1200);
  await page.getByRole('radio', { name: /AM|PM/ }).first().click();
  await page.getByRole('button', { name: /^Сохранить/ }).last().click();
  await page.waitForTimeout(1500);
  await shot('h12-settings');
  await go('/biz/journal');
  await page.waitForTimeout(2500);
  await shot('h12-journal');
  const jtxt = await page.locator('main').innerText();
  const jAm = (jtxt.match(/\d{1,2}:\d{2}\s?(AM|PM)/g) ?? []).length;
  const j24 = (jtxt.match(/\b(1[3-9]|2[0-3]):\d{2}\b/g) ?? []).length;
  await go('/biz/records');
  await page.waitForTimeout(2000);
  await shot('h12-records');
  const rtxt = await page.locator('main').innerText();
  const rAm = (rtxt.match(/\d{1,2}:\d{2}\s?(AM|PM)/g) ?? []).length;
  await ctx.close();
  // клиент: профиль → 12 часов → «Мои записи»
  const c = await ctxPage({ persona: 'client', device: 'phone' });
  await c.go('/profile');
  await c.page.waitForTimeout(1200);
  await c.page.getByRole('radio', { name: /12 часов/ }).first().click();
  await c.page.waitForTimeout(1200);
  await c.go('/bookings');
  await c.page.waitForTimeout(1500);
  await c.shot('h12-client-bookings');
  const ctxt = await c.page.locator('main').innerText();
  const cAm = (ctxt.match(/\d{1,2}:\d{2}\s?(AM|PM)/g) ?? []).length;
  const c24 = (ctxt.match(/\b(1[3-9]|2[0-3]):\d{2}\b/g) ?? []).length;
  await c.ctx.close();
  if (!jAm || !cAm) throw new Error(`AM/PM: журнал ${jAm} (24ч-время ${j24}), записи ${rAm}, клиент ${cAm} (24ч ${c24})`);
  return `AM/PM: журнал ${jAm} (остатков 24ч ${j24}), записи ${rAm}, клиент ${cAm} (остатков 24ч ${c24}); errors ${errors.length + c.errors.length} ${[...errors, ...c.errors].slice(0, 3).join(' | ')}`;
});

// 6. Смена персоны и сброс демо-данных: правка владельца переживает смену персоны; сброс возвращает сид
await step('demo', async () => {
  const { ctx, page, go, shot, errors } = await ctxPage({ extra: '&showdemo=1' });
  // правка: переименуем клиента через API мок-базы нельзя — возьмём специализацию сотрудника
  await go('/biz/staff');
  await page.getByText('Ани Саргсян').first().click();
  await page.waitForURL(/\/biz\/staff\/[^/?]+/, { timeout: 60_000 });
  const href = new URL(page.url()).pathname;
  await page.waitForTimeout(1500);
  const val = `DEMO-${Date.now() % 100000}`;
  await page.getByLabel(/Специализация/).first().fill(val);
  await page.getByRole('button', { name: /^Сохранить/ }).last().click();
  await page.getByText('Изменения сохранены').first().waitFor({ timeout: 10_000 });
  // смена персоны через демо-панель (тост перекрывает кнопку — ждём, пока уйдёт)
  await page.mouse.move(700, 300);
  await page.getByText('Изменения сохранены').first().waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
  await page.locator('[data-demo-fab]').click();
  await page.waitForTimeout(600);
  await shot('demo-panel');
  const combo = page.getByRole('dialog').getByRole('combobox').first();
  await combo.click();
  await page.getByRole('option', { name: /Администратор салона/ }).click();
  await page.waitForTimeout(2500);
  await shot('demo-admin');
  const urlAdmin = page.url();
  // обратно владелец
  await page.goto(`${BASE}${href}?demo=owner&lang=ru`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const kept = await page.getByLabel(/Специализация/).first().inputValue();
  // сброс
  await page.locator('[data-demo-fab]').click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Сбросить демо-данные/ }).click();
  await page.waitForTimeout(400);
  await shot('demo-reset-confirm');
  await page.getByRole('alertdialog').or(page.getByRole('dialog').last()).getByRole('button', { name: /^Сбросить демо-данные$/ }).last().click();
  await page.getByText('Демо-данные созданы заново').first().waitFor({ timeout: 10_000 });
  await page.goto(`${BASE}${href}?demo=owner&lang=ru`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const afterReset = await page.getByLabel(/Специализация/).first().inputValue();
  await shot('demo-after-reset');
  // после сброса журнал и клиенты не пустые
  await page.goto(`${BASE}/biz/clients?demo=owner&lang=ru`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const clientsText = await page.locator('main').innerText();
  await ctx.close();
  if (kept !== val) throw new Error(`после смены персоны правка потерялась: «${kept}» вместо «${val}»`);
  if (afterReset === val) throw new Error('после сброса правка осталась');
  return `админ: ${urlAdmin}; правка пережила смену персоны; после сброса «${afterReset}»; клиенты после сброса: ${clientsText.length} симв.; errors ${errors.length} ${errors.slice(0, 3).join(' | ')}`;
});

// 7. Фразы с именами: «Подтвердить завтра» → «Подтвердил» → тост (ru/en/hy); снимки окна с текстом сообщения
await step('phrases', async () => {
  const L = { ru: ['Напомнить', 'Подтвердил'], en: ['Remind', 'Confirmed'], hy: ['Հիշեցնել', 'Հաստատեց'] };
  const out = [];
  for (const lang of ['ru', 'en', 'hy']) {
    const { ctx, page, go, shot } = await ctxPage({ lang });
    await go('/biz/journal');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: L[lang][0], exact: true }).first().click();
    await page.waitForTimeout(1200);
    await shot(`phr-${lang}-sheet`);
    await page.getByRole('button', { name: L[lang][1], exact: true }).first().click();
    const toast = page.locator('[data-sonner-toast], [role="status"], li[data-type]').filter({ hasText: /./ }).last();
    await page.waitForTimeout(800);
    await shot(`phr-${lang}-toast`);
    out.push(`${lang}: «${(await toast.innerText().catch(() => '?')).replace(/\s+/g, ' ').slice(0, 90)}»`);
    await ctx.close();
  }
  return out.join('; ');
});

await browser.close();
release();
console.log(JSON.stringify(results, null, 1));
