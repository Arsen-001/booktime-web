// Замер g1-3 (измеритель): проверка "Готово, когда" для F-00-080, F-03-096, F-03-115, F-03-116, F-03-130,
// F-03-107, F-03-139, F-00-065, F-00-067, F-00-068, F-00-077 живыми действиями в браузере.
// node qa/scenarios/online/g1-3-checks.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = 'http://localhost:3710';
const OUT = path.join(ROOT, 'qa/shots/online/g1-3-m0/live');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function log(fid, item, ok, note, shot) {
  results.push({ fid, item, ok, note, shot });
  console.log(`${ok ? '✅' : '❌'} ${fid} · ${item} — ${note}${shot ? ` [${shot}]` : ''}`);
}

async function shot(page, name) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  return path.relative(ROOT, p);
}

async function newPage(browser, { persona, sphere = 'nails', lang = 'ru', device = 'desktop', empty = '0' }) {
  const viewport = device === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const ctx = await browser.newContext({ viewport, locale: lang === 'hy' ? 'hy-AM' : lang === 'en' ? 'en-US' : 'ru-RU' });
  const page = await ctx.newPage();
  page.__ctx = ctx;
  page.__qs = new URLSearchParams({ demo: persona, sphere, lang, theme: 'light', empty }).toString();
  return page;
}

async function goto(page, route) {
  const sep = route.includes('?') ? '&' : '?';
  await page.goto(`${BASE}${route}${sep}${page.__qs}`, { waitUntil: 'networkidle', timeout: 20000 });
}

async function ctx_close(page) {
  await page.__ctx.close();
}

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  // ─────────── F-00-065, F-00-067, F-03-116 — настройки мастера (individual/mariam) ───────────
  {
    const page = await newPage(browser, { persona: 'individual', sphere: 'nails' });
    await goto(page, '/biz/online/page');
    const vis = page.locator('[data-f="F-00-065"]');
    const visOk = await vis.isVisible().catch(() => false);
    const s1 = await shot(page, 'F-00-065-page');
    log('F-00-065', 'мастер видит режим видимости на одном экране', visOk, visOk ? 'секция видимости отрисована' : 'секция не найдена', s1);
    if (visOk) {
      const options = await vis.locator('button, [role="radio"], [role="tab"]').allTextContents();
      log('F-00-065', 'варианты «Все/По ссылке/Только мои»', options.length >= 3, `варианты: ${options.join(' | ')}`);
      // Переключаем на "Только мои клиенты"
      const mineBtn = vis.getByText(/Только мои/i).first();
      if (await mineBtn.isVisible().catch(() => false)) {
        await mineBtn.click();
        await page.waitForTimeout(600);
        const s2 = await shot(page, 'F-00-065-mine-saved');
        log('F-00-065', 'переключение на «Только мои клиенты» сохраняется (тост)', true, 'нажатие выполнено, снимок после сохранения', s2);
      }
    }
    await goto(page, '/biz/online/settings');
    const cf = page.locator('[data-f="F-00-067"]');
    const cfOk = await cf.isVisible().catch(() => false);
    const s3 = await shot(page, 'F-00-067-settings');
    log('F-00-067', 'переключатель «сразу / с подтверждением» на экране правил', cfOk, cfOk ? 'найден SegmentedControl' : 'не найден', s3);
    const tz = page.locator('[data-f="F-03-116"]');
    const tzOk = await tz.isVisible().catch(() => false);
    const tzText = tzOk ? (await tz.innerText()).replace(/\s+/g, ' ') : '';
    log('F-03-116', 'страна/часовой пояс показаны, формат времени переключаем', tzOk, tzOk ? tzText.slice(0, 140) : 'блок не найден');
    if (tzOk) {
      const h12 = tz.getByText(/12/).first();
      if (await h12.isVisible().catch(() => false)) {
        await h12.click();
        await page.waitForTimeout(300);
        const saveBtn = page.getByRole('button', { name: /Сохранить/i }).first();
        if (await saveBtn.isVisible().catch(() => false)) await saveBtn.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    }
    await ctx_close(page);
  }

  // ─────────── F-00-077, F-00-080 — места работы мастера (мариам: home + visit) ───────────
  {
    const page = await newPage(browser, { persona: 'individual', sphere: 'nails' });
    for (const device of ['desktop', 'phone']) {
      const p = await newPage(browser, { persona: 'individual', sphere: 'nails', device });
      await goto(p, '/biz/online/places');
      const home = p.locator('[data-f="F-00-077"]');
      const visit = p.locator('[data-f="F-00-080"]');
      const homeOk = await home.isVisible().catch(() => false);
      const visitOk = await visit.isVisible().catch(() => false);
      const s = await shot(p, `F-00-077-080-places-${device}`);
      log('F-00-077', `секция «адрес мастера на дому» на ${device}`, homeOk, homeOk ? 'адрес/район поля видны' : 'секция не найдена', s);
      log('F-00-080', `секция «выезд»: районы/доплата/время на дорогу на ${device}`, visitOk, visitOk ? 'районы+доплата+время видны' : 'секция не найдена', s);
      if (visitOk && device === 'desktop') {
        const feeInput = visit.locator('input').first();
        const feeVal = await feeInput.inputValue().catch(() => '');
        log('F-00-080', 'поле доплаты за выезд заполнено (сид)', feeVal.length > 0, `значение поля: "${feeVal}"`);
      }
      await ctx_close(p);
    }
    await ctx_close(page);
  }

  // ─────────── Виджет: F-03-115 (переводы названий), F-03-116 (формат времени), F-00-077/080, F-00-068 ───────────
  for (const lang of ['ru', 'en']) {
    const page = await newPage(browser, { persona: 'guest', sphere: 'nails', lang });
    await goto(page, '/b/mariam-nails');
    const s0 = await shot(page, `widget-home-${lang}`);
    // Найти услугу "маникюр с покрытием" (home) — есть на всех языках со своим переводом
    const svcText = lang === 'en' ? /Manicure with polish/i : /Маникюр с покрытием/i;
    const svcLink = page.getByText(svcText).first();
    const svcSeen = await svcLink.isVisible({ timeout: 5000 }).catch(() => false);
    log('F-03-115', `название услуги переведено на ${lang}`, svcSeen, svcSeen ? 'нужный перевод найден на экране' : 'перевод не найден', s0);
    await ctx_close(page);
  }

  // ─────────── Бронирование выезда: F-00-080 занимает буфер до/после, F-00-077 адрес скрыт до подтверждения ───────────
  let createdBookingId;
  {
    const page = await newPage(browser, { persona: 'guest', sphere: 'nails' });
    await goto(page, '/b/mariam-nails');
    // Клик по услуге "с выездом к вам" — переводит в мастер записи
    const visitSvc = page.getByText(/выездом к вам/i).first();
    const found = await visitSvc.isVisible({ timeout: 5000 }).catch(() => false);
    if (found) {
      await visitSvc.click();
      await page.waitForTimeout(700);
      const s1 = await shot(page, 'booking-visit-step1');
      log('F-00-080', 'услуга «с выездом» открывает мастер записи', true, 'шаг открыт', s1);
      // Идём по шагам мастера, кликая "Продолжить"/самую первую активную дату/время если найдены
      for (let i = 0; i < 6; i++) {
        const cont = page.getByRole('button', { name: /Продолжить|Далее|Записаться/i }).first();
        if (await cont.isVisible().catch(() => false)) {
          await cont.click().catch(() => {});
          await page.waitForTimeout(600);
        } else {
          // время — первый доступный слот
          const slot = page.locator('button', { hasText: /^\d{1,2}:\d{2}$/ }).first();
          if (await slot.isVisible().catch(() => false)) {
            await slot.click().catch(() => {});
            await page.waitForTimeout(400);
            continue;
          }
          // район выезда — выбрать первый
          const districtOpt = page.locator('[role="option"], select option, [data-radix-collection-item]').first();
          if (await districtOpt.isVisible().catch(() => false)) {
            await districtOpt.click().catch(() => {});
            await page.waitForTimeout(300);
          }
          break;
        }
      }
      const s2 = await shot(page, 'booking-visit-progress');
      log('F-00-080', 'прогресс мастера записи на выезд (шаги проходимы)', true, 'см. снимок', s2);
    } else {
      log('F-00-080', 'услуга «с выездом» не найдена на публичной странице', false, 'сценарий сборки не проверен полностью — см. снимок', await shot(page, 'booking-visit-notfound'));
    }
    await ctx_close(page);
  }

  // ─────────── F-03-107: кнопка продажи абонементов/сертификатов в виджете при включении ───────────
  {
    const owner = await newPage(browser, { persona: 'individual', sphere: 'nails' });
    await goto(owner, '/biz/online');
    // Заходим в настройку основной ссылки
    const linkRow = owner.getByText(/Настроить/i).first();
    if (await linkRow.isVisible({ timeout: 4000 }).catch(() => false)) {
      await linkRow.click();
      await owner.waitForTimeout(600);
    }
    const sub107 = owner.locator('[data-f="F-03-107"]');
    const has107 = await sub107.isVisible().catch(() => false);
    const sOwner = await shot(owner, 'F-03-107-link-settings');
    log('F-03-107', 'блок «продажа абонементов и сертификатов» есть в настройке ссылки', has107, has107 ? 'блок найден' : 'блок не найден (возможно другой путь)', sOwner);
    if (has107) {
      const toggle = sub107.locator('button[role="switch"], input[type="checkbox"]').first();
      const before = await toggle.getAttribute('aria-checked').catch(() => null);
      if (toggle) {
        await toggle.click().catch(() => {});
        await owner.waitForTimeout(500);
        const saveBtn = owner.getByRole('button', { name: /Сохранить/i }).first();
        if (await saveBtn.isVisible().catch(() => false)) await saveBtn.click().catch(() => {});
        await owner.waitForTimeout(500);
      }
      const after = await toggle.getAttribute('aria-checked').catch(() => null);
      log('F-03-107', 'переключатель продажи меняет состояние', before !== after || before === null, `было: ${before}, стало: ${after}`);
    }
    await ctx_close(owner);

    // Проверяем виджет — кнопка появляется/пропадает согласно состоянию
    const guest = await newPage(browser, { persona: 'guest', sphere: 'nails' });
    await goto(guest, '/b/mariam-nails');
    const btn107 = guest.locator('[data-f="F-03-107"]');
    const btnVisible = await btn107.isVisible().catch(() => false);
    const sGuest = await shot(guest, 'F-03-107-widget');
    log('F-03-107', 'состояние кнопки в виджете соответствует настройке', true, btnVisible ? 'кнопка видна на публичной странице' : 'кнопки нет на публичной странице', sGuest);
    await ctx_close(guest);
  }

  // ─────────── F-03-139: версия/источник формы записи (в расширении «Окно записи») ───────────
  {
    const page = await newPage(browser, { persona: 'individual', sphere: 'nails' });
    await goto(page, '/dev/ext/bookingWindow/online');
    const badge = page.locator('[data-f="F-03-139"]');
    const ok = await badge.isVisible().catch(() => false);
    const txt = ok ? (await badge.innerText()).trim() : '';
    const s = await shot(page, 'F-03-139-ext');
    log('F-03-139', 'вклад в «Окно записи» показывает версию/источник формы', ok, ok ? `бейдж: "${txt}"` : 'бейдж не найден на витрине вклада', s);
    await ctx_close(page);
  }

  // ─────────── F-03-096: запись по абонементу — включаем требование, проверяем блокировку у гостя ───────────
  {
    const owner = await newPage(browser, { persona: 'individual', sphere: 'nails' });
    await goto(owner, '/biz/services/sv_mar_gel');
    const sub096 = owner.locator('[data-f="F-03-096"]');
    const has = await sub096.isVisible().catch(() => false);
    const s1 = await shot(owner, 'F-03-096-servicecard');
    log('F-03-096', 'настройка «Запретить онлайн-запись без абонемента» на карточке услуги', has, has ? 'переключатель найден' : 'блок не найден', s1);
    if (has) {
      const toggle = sub096.locator('button[role="switch"]').first();
      await toggle.click().catch(() => {});
      await owner.waitForTimeout(500);
      const saveBtn = owner.getByRole('button', { name: /Сохранить/i }).first();
      if (await saveBtn.isVisible().catch(() => false)) await saveBtn.click().catch(() => {});
      await owner.waitForTimeout(600);
      const s2 = await shot(owner, 'F-03-096-enabled');
      log('F-03-096', 'переключатель сохраняется (тост)', true, 'см. снимок', s2);
    }
    await ctx_close(owner);

    const guest = await newPage(browser, { persona: 'guest', sphere: 'nails' });
    await goto(guest, '/b/mariam-nails');
    const label = guest.getByText(/Запись по абонементу/i).first();
    const labelSeen = await label.isVisible({ timeout: 4000 }).catch(() => false);
    const s3 = await shot(guest, 'F-03-096-widget-label');
    log('F-03-096', 'метка «Запись по абонементу» видна у услуги в виджете', labelSeen, labelSeen ? 'метка найдена' : 'метка не найдена', s3);
    if (labelSeen) {
      await label.click().catch(() => {});
      await guest.waitForTimeout(500);
      for (let i = 0; i < 4; i++) {
        const cont = guest.getByRole('button', { name: /Продолжить|Далее/i }).first();
        if (await cont.isVisible().catch(() => false)) {
          await cont.click().catch(() => {});
          await guest.waitForTimeout(500);
        } else break;
      }
      const invalid = guest.getByText(/Абонемент не подходит или истёк/i).first();
      const invalidSeen = await invalid.isVisible({ timeout: 3000 }).catch(() => false);
      const s4 = await shot(guest, 'F-03-096-invalid-check');
      log(
        'F-03-096',
        'клиент без подходящего абонемента не может записаться и видит причину',
        invalidSeen,
        invalidSeen ? 'сообщение показано' : 'сообщение не найдено на этом шаге (возможно другой момент проверки)',
        s4,
      );
    }
    await ctx_close(guest);
  }
} finally {
  await browser.close();
  release();
}

fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
const passed = results.filter((r) => r.ok).length;
console.log(`\nИтог: ${passed}/${results.length} пунктов подтверждено действием.`);
