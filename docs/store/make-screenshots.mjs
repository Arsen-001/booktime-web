#!/usr/bin/env node
/**
 * Скриншоты для App Store и Google Play (04.10.2026) — с дев-сервера в моковом режиме (демо-данные, без настоящих людей).
 *
 *   bash scripts/ensure-dev.sh
 *   node docs/store/make-screenshots.mjs                         # оба приложения, ru, hy и en, все устройства
 *   node docs/store/make-screenshots.mjs --app client --lang ru --device iphone69
 *
 * Куда: docs/store/screenshots/<client|business>/<lang>/<device>/NN-<имя>.png
 *   iphone69 — 1320×2868 (iPhone 6.9″, обязательный размер App Store; 6.5″ Apple берёт из него сам)
 *   ipad13   — 2064×2752 (iPad 13″; нужен, только если приложение остаётся универсальным)
 *   android  — 1080×1920 (телефон Google Play; длинная сторона не больше двух коротких)
 *
 * Экран снимается как в приложении (05.10.2026): строка браузера телефона с «BookTimeApp/client» или
 * «BookTimeApp/business» (как appendUserAgent в booktime-mobile/shared/config.ts — по ней сервер рисует Business
 * без клиентских вкладок) и заглушка моста window.Capacitor (ios/android) — с ней сайт прячет то, что в приложениях
 * скрыто (useHideDigitalPurchases: подписка, монеты); без строки браузера и без демо-кнопки ([data-demo-fab]).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'docs/store/screenshots');
const BASE = process.env.BASE ?? 'http://localhost:3710';

const UA_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const UA_IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36';

/** platform — что отвечает заглушка window.Capacitor.getPlatform() */
const DEVICES = {
  iphone69: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, platform: 'ios', ua: UA_IOS },
  ipad13: { viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, platform: 'ios', ua: UA_IPAD },
  android: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, platform: 'android', ua: UA_ANDROID },
};

/** Мост Capacitor, как его кладёт приложение (src/lib/native/bridge.ts): плагины отвечают «unavailable» — сайт их пропускает */
function capacitorStub(platform) {
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => platform,
    nativePromise: () => Promise.reject({ code: 'unavailable', message: 'screenshot' }),
    addListener: () => ({ remove: () => {} }),
  };
}

/**
 * Экраны. persona/sphere — демо-персона (src/demo/settings.ts). steps — действия перед снимком:
 * { click: селектор } | { wait: мс } | { scroll: px }.
 */
const SHOTS = {
  client: [
    { name: 'home', route: '/', persona: 'client' },
    { name: 'search', route: '/search?sphere=nails', persona: 'client' },
    { name: 'salon', route: '/b/nuri-nail-studio', persona: 'client' },
    { name: 'booking-time', route: '/b/nuri-nail-studio/book', persona: 'client', steps: 'pickServiceAndTime' },
    { name: 'my-bookings', route: '/bookings', persona: 'client' },
  ],
  business: [
    { name: 'journal', route: '/biz/journal', persona: 'owner', sphere: 'nails', steps: 'scrollToBookings' },
    { name: 'clients', route: '/biz/clients', persona: 'owner', sphere: 'nails' },
    { name: 'booking-window', route: '/biz/journal', persona: 'owner', sphere: 'nails', steps: 'openBooking' },
    { name: 'orders', route: '/biz/orders', persona: 'owner', sphere: 'repair' },
    { name: 'online-booking', route: '/biz/online', persona: 'owner', sphere: 'nails' },
  ],
};

/** Сценарии действий перед снимком: шаг не получился — снимаем как есть и пишем предупреждение */
const STEPS = {
  /** Запись: отметить услугу → «Продолжить» → «Любой мастер» → шаг выбора времени */
  async pickServiceAndTime(page) {
    await page.getByRole('checkbox').nth(1).click({ timeout: 8000 });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^(Продолжить|Continue|Շարունակել)$/ }).last().click({ timeout: 8000 });
    await page.waitForTimeout(1500);
    // Шаг «Мастер» → «Любой мастер» → шаг «Время»
    await page.getByText(/^(Любой мастер|Any master|Ցանկացած վարպետ)$/).first().click({ timeout: 8000 });
    await page.waitForTimeout(1500);
    // День, где больше всего свободного времени (из ближайших 8 дней с окнами), и одно время отмечено
    const slots = page.getByRole('button', { name: /^\d{1,2}:\d{2}$/ });
    const days = page.locator('[role="grid"] button:not([disabled]), table button:not([disabled])');
    let best = { i: -1, n: await slots.count() };
    const total = Math.min(await days.count(), 8);
    for (let i = 0; i < total; i++) {
      await days.nth(i).click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
      const n = await slots.count();
      if (n > best.n) best = { i, n };
    }
    if (best.i >= 0) await days.nth(best.i).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    if ((await slots.count()) > 1) await slots.nth(1).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    // Нажатие на время прокручивает страницу: на низком экране (Android) календарь обрезался сверху —
    // ставим календарь к верху экрана, на высоком — всё с начала (видно и шаги, и время)
    await page.evaluate(() => {
      const grid = document.querySelector('[role="grid"], table');
      window.scrollTo(0, 0);
      // Низкий экран: месяц и «Ближайшее» сверху, шаги уходят за край целиком, ниже — утро и день
      if (window.innerHeight < 800 && grid) window.scrollBy(0, grid.getBoundingClientRect().top - 120);
    });
    await page.waitForTimeout(400);
  },
  /** Журнал: утро до первой записи пустое — прокрутить к первой записи (на телефоне иначе видна одна) */
  async scrollToBookings(page) {
    await page.evaluate(() => {
      const first = [...document.querySelectorAll('[data-booking]')].sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
      )[0];
      if (!first) return;
      first.scrollIntoView({ block: 'start' });
      // Над записью оставить строку времени: прокручиваем назад её ближайший прокручиваемый контейнер
      let el = first.parentElement;
      while (el && el.scrollHeight <= el.clientHeight) el = el.parentElement;
      (el ?? document.scrollingElement)?.scrollBy(0, -48);
    });
    await page.waitForTimeout(400);
  },
  /** Окно записи: открыть первую запись в журнале */
  async openBooking(page) {
    await page.locator('[data-booking]').first().click({ timeout: 8000 });
    await page.waitForTimeout(1500);
  },
};

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i === -1 ? d : args[i + 1].split(',');
};
const apps = opt('app', ['client', 'business']);
const langs = opt('lang', ['ru', 'hy', 'en']);
const devices = opt('device', Object.keys(DEVICES));
const only = opt('only', null);

async function waitLoaded(page) {
  await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"], [data-skeleton]'), null, { timeout: 15000, polling: 200 })
    .catch(() => {});
}

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const warnings = [];
try {
  for (const app of apps) {
    for (const lang of langs) {
      for (const device of devices) {
        const dir = path.join(OUT, app, lang, device);
        fs.mkdirSync(dir, { recursive: true });
        let n = 0;
        for (const s of SHOTS[app]) {
          n++;
          if (only && !only.includes(s.name)) continue;
          const { platform, ua, ...dev } = DEVICES[device];
          const ctx = await browser.newContext({
            ...dev,
            userAgent: `${ua} BookTimeApp/${app}`,
            locale: lang === 'hy' ? 'hy-AM' : lang === 'en' ? 'en-US' : 'ru-RU',
          });
          await ctx.addInitScript(capacitorStub, platform);
          const page = await ctx.newPage();
          const q = new URLSearchParams({ demo: s.persona, empty: '0', sphere: s.sphere ?? 'nails', lang, theme: 'light' });
          const url = `${BASE}${s.route}${s.route.includes('?') ? '&' : '?'}${q}`;
          await page.goto(url, { waitUntil: 'load', timeout: 120000 });
          await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
          await page.addStyleTag({ content: '[data-demo-fab]{display:none !important} nextjs-portal{display:none !important}' });
          await page.evaluate(() => document.fonts.ready.then(() => true));
          await waitLoaded(page);
          if (s.steps) {
            try {
              await STEPS[s.steps](page);
              await waitLoaded(page);
            } catch (e) {
              warnings.push(`${app}/${lang}/${device}/${s.name}: ${e.message}`);
            }
          }
          // Ссылки в кабинете строятся от адреса сервера («localhost:3710/b/…») — в магазине показываем боевой адрес
          await page.evaluate((host) => {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.includes(host)) n.nodeValue = n.nodeValue.replaceAll(host, 'booktime.am');
            document.querySelectorAll('input, textarea').forEach((i) => {
              if (i.value.includes(host)) i.value = i.value.replaceAll(host, 'booktime.am');
            });
          }, new URL(BASE).host);
          await page.waitForTimeout(500);
          const file = path.join(dir, `${String(n).padStart(2, '0')}-${s.name}.png`);
          await page.screenshot({ path: file });
          console.log(path.relative(ROOT, file));
          await ctx.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  release();
}
if (warnings.length) console.warn(`\nПредупреждения:\n${warnings.join('\n')}`);
