// Сквозные сценарии (e2e) — общий движок прогона. Принадлежит проверке «сквозные сценарии» (qa/e2e/**).
//
// Одна цепочка = один контекст браузера (одна «база» в localStorage), персоны переключаются адресом
// ?demo=<персона> прямо в этом контексте — так запись, созданная клиентом, остаётся в той же базе,
// и её видят администратор, мастер и наша панель. Телефон/десктоп — сменой размера окна, а не контекста.
//
// Статусы шага: pass ✅ · fail ❌ · wait ⏳ (раздел ещё не построен — «ждёт раздела <id>») ·
// skip ⛔ (не прогнан: упал шаг, от которого он зависит).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BASE = process.env.E2E_BASE ?? 'http://localhost:3710';
export const SHOTS = path.join(ROOT, 'qa/shots/e2e');

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
};

export class Pending extends Error {
  constructor(area, why) {
    super(`ждёт раздела ${area}${why ? ` — ${why}` : ''}`);
    this.area = area;
  }
}

export class Fail extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.meta = meta;
  }
}

// ─────────────────────────── Даты (Ереван = локальное время машины) ───────────────────────────

export function isoDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function addDays(date, n) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
export const today = () => isoDate(new Date());
/** 0 = понедельник … 6 = воскресенье (как WeekTemplate) */
export function weekdayIndex(date) {
  return (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
}
/** Ближайшая дата ≥ from с нужным днём недели (0 = пн) */
export function nextWeekday(from, idx) {
  for (let i = 0; i < 8; i++) {
    const d = addDays(from, i);
    if (weekdayIndex(d) === idx) return d;
  }
  return from;
}
export function nowDateTime() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${isoDate(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Вклад раздела в хост ещё заглушка в коде (src/areas/<area>/extensions/<Host>.tsx рисует ExtensionStub)?
 *  Хосты прячут вкладки вкладов-заглушек, поэтому на экране их не найти — смотрим файл. */
export function extFileIsStub(area, host) {
  try {
    return /ExtensionStub/.test(fs.readFileSync(path.join(ROOT, `src/areas/${area}/extensions/${host}.tsx`), 'utf8'));
  } catch {
    return true;
  }
}

// ─────────────────────────── Контекст шага ───────────────────────────

export function makeT(page, chainId, state) {
  const t = {
    page,
    state,
    notes: [],
    device: 'phone',
    persona: undefined,

    note(text) {
      t.notes.push(text);
    },

    wait(area, why) {
      throw new Pending(area, why);
    },

    fail(message) {
      throw new Fail(message);
    },

    assert(cond, message) {
      if (!cond) throw new Fail(message);
    },

    /** Открыть экран от лица персоны. device: phone | desktop */
    async go(persona, route, device = 'phone') {
      t.device = device;
      t.persona = persona;
      await t.page.setViewportSize(VIEWPORTS[device]);
      const sep = route.includes('?') ? '&' : '?';
      const url = `${BASE}${route}${sep}demo=${persona}&lang=ru&theme=light&api=normal`;
      for (let attempt = 0; ; attempt++) {
        try {
          const resp = await t.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
          // q4: соседи ломают сборку (500 / «Module not found») — это не дефект цепочки: ждём починки до 6 мин
          const broken = async () =>
            (resp && resp.status() >= 500) ||
            /Build Error|Failed to compile|Module not found/.test(await t.page.evaluate(() => document.body?.innerText ?? '').catch(() => ''));
          if (await broken()) {
            if (attempt >= 36) throw new Error('сборка дев-сервера сломана (не дефект раздела) — шаг не прогнан');
            await t.page.waitForTimeout(10000);
            continue;
          }
          break;
        } catch (e) {
          // переход прерван клиентским router.push предыдущего экрана — повторяем
          if (attempt >= 2 || !/ERR_ABORTED|interrupted/.test(String(e.message))) throw e;
          await t.page.waitForTimeout(600);
        }
      }
      // гидратация: кнопки получают обработчики React (__reactProps$…) — до этого клик «уходит в пустоту»
      await t.page
        .waitForFunction(() => {
          const el = document.querySelector('main button, main a, button');
          return !el || Object.keys(el).some((k) => k.startsWith('__reactProps'));
        }, null, { timeout: 30000 })
        .catch(() => {});
      await t.settle();
      await t.closeTours();
    },

    /** q4: подсказки-туры первого входа («Шаг 1 из 4 · Далее / Закрыть») перекрывают экран — закрываем.
     *  Они запоминаются в localStorage bp.onb.<персона>:… — в следующий раз в этой цепочке не появятся. */
    async closeTours() {
      for (let i = 0; i < 3; i++) {
        const tour = t.page.locator('[role="dialog"]').filter({ visible: true }).filter({ hasText: /Шаг \d+ из \d+/ });
        if (!(await tour.count())) return;
        const close = tour.last().getByRole('button', { name: /^(Закрыть|Пропустить|Понятно)$/ }).first();
        if (!(await close.count())) return;
        t.toursClosed = (t.toursClosed ?? 0) + 1;
        await close.click().catch(() => {});
        await t.page.waitForTimeout(300);
      }
    },

    /** Дождаться, пока экран дорисуется: сеть, скелетоны и aria-busy исчезли */
    async settle(extra = 300) {
      await t.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await t.page
        .waitForFunction(
          () => {
            const busy = [...document.querySelectorAll('[aria-busy="true"], [data-skeleton]')].filter((el) => {
              if (el.closest('[data-showcase]')) return false;
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            });
            return busy.length === 0;
          },
          null,
          { timeout: 15000 },
        )
        .catch(() => {});
      await t.page.waitForTimeout(extra);
    },

    async text() {
      return t.page.evaluate(() => document.body.innerText);
    },

    /** Текст без плавающих тостов (чтобы «Запись создана» из тоста не выдавалась за содержимое) */
    async mainText() {
      return t.page.evaluate(() => {
        const main = document.querySelector('main') ?? document.body;
        return main.innerText;
      });
    },

    async toasts() {
      return t.page.evaluate(() => [...document.querySelectorAll('[role="status"], [role="alert"]')].map((e) => e.innerText.trim()).filter(Boolean));
    },

    async expectText(needle, message) {
      const txt = await t.text();
      const ok = needle instanceof RegExp ? needle.test(txt) : txt.includes(needle);
      if (!ok) throw new Fail(message ?? `на экране нет «${needle}»`);
    },

    async expectNoText(needle, message) {
      const txt = await t.text();
      const hit = needle instanceof RegExp ? needle.test(txt) : txt.includes(needle);
      if (hit) throw new Fail(message ?? `на экране есть «${needle}», а не должно`);
    },

    async has(needle) {
      const txt = await t.text();
      return needle instanceof RegExp ? needle.test(txt) : txt.includes(needle);
    },

    async click(selector, opts = {}) {
      // q3: берём первый ВИДИМЫЙ (в шапке кабинета две копии кнопок — телефонная и настольная)
      const all = t.page.locator(selector);
      const vis = all.filter({ visible: true }).first();
      const loc = (await vis.count().catch(() => 0)) ? vis : all.first();
      await loc.waitFor({ state: 'visible', timeout: opts.timeout ?? 20000 }).catch(() => {
        throw new Fail(`не нашёл, куда нажать: ${selector}`);
      });
      // q3: ссылка (или кнопка внутри ссылки) — ждём смены адреса: под нагрузкой переход идёт секунды
      const href = await loc.evaluate((e) => e.closest('a[href]')?.getAttribute('href') ?? null).catch(() => null);
      const before = t.page.url();
      await loc.click({ timeout: 20000 });
      if (href && !href.startsWith('#') && !href.startsWith('http') && new URL(href, before).href !== before) {
        const want = new URL(href, before).pathname;
        await t.page.waitForURL((u) => u.pathname === want, { timeout: 45000 }).catch(() => {});
        await t.page
          .waitForFunction(() => {
            const el = document.querySelector('main button, main a');
            return !el || Object.keys(el).some((k) => k.startsWith('__reactProps'));
          }, null, { timeout: 20000 })
          .catch(() => {});
      }
      await t.settle(opts.after ?? 300);
    },

    /** Нажать кнопку в верхнем открытом окне (ConfirmDialog / Modal / Sheet) по подписи */
    async clickInDialog(name, opts = {}) {
      const dlg = t.page.locator('[role="dialog"], [role="alertdialog"]').last();
      await dlg.waitFor({ state: 'visible', timeout: 12000 }).catch(() => {
        throw new Fail(`нет открытого окна, чтобы нажать «${name}»`);
      });
      const btn = dlg.getByRole('button', { name }).last();
      if (!(await btn.count())) throw new Fail(`в окне нет кнопки «${name}»: ${(await dlg.innerText()).replace(/\n+/g, ' · ').slice(0, 160)}`);
      await btn.click({ timeout: 12000 });
      await t.settle(opts.after ?? 600);
    },

    /**
     * Выбрать вариант в нашем Select/Combobox из @/ui (нативных <select> больше нет, §0.3):
     * trigger — селектор кнопки role=combobox (или локатор), label — подпись варианта (строка или RegExp).
     * Если на месте trigger старый <select> — выбирает в нём.
     */
    async pick(trigger, label) {
      const loc = typeof trigger === 'string' ? t.page.locator(trigger).first() : trigger.first();
      await loc.waitFor({ state: 'visible', timeout: 12000 }).catch(() => {
        throw new Fail(`нет списка для выбора: ${trigger}`);
      });
      if ((await loc.evaluate((e) => e.tagName.toLowerCase())) === 'select') {
        await loc.selectOption(typeof label === 'string' ? { label } : { index: 1 });
        await t.settle(200);
        return;
      }
      await loc.click();
      await t.settle(150);
      const opt = t.page.getByRole('option', { name: label }).first();
      if (!(await opt.count())) {
        const all = await t.page.getByRole('option').allInnerTexts();
        await t.page.keyboard.press('Escape');
        throw new Fail(`в списке нет варианта «${label}» (есть: ${all.join(' | ').slice(0, 200)})`);
      }
      await opt.click();
      await t.settle(200);
    },

    async fill(selector, value) {
      const loc = t.page.locator(selector).first();
      await loc.waitFor({ state: "visible", timeout: 12000 }).catch(() => {
        throw new Fail(`нет поля: ${selector}`);
      });
      await loc.fill(value);
    },

    async count(selector) {
      return t.page.locator(selector).count();
    },

    /** Состояние моковой базы (localStorage bp-mock-db) — для сверки «данные дошли» */
    async db() {
      if (!t.page.url().startsWith(BASE)) await t.go(t.persona ?? 'client', '/');
      await t.page.waitForTimeout(700); // запись в localStorage отложена на 400 мс
      // свежий контекст: база засевается асинхронно — ждём, пока она ляжет в localStorage
      await t.page.waitForFunction(() => Boolean(localStorage.getItem('bp-mock-db')), null, { timeout: 20000 }).catch(() => {});
      return t.page.evaluate(() => {
        const raw = localStorage.getItem('bp-mock-db');
        return raw ? JSON.parse(raw).state : undefined;
      });
    },

    /**
     * Подготовка данных, для которой ещё нет экрана (например, срок бесплатной отмены мастера):
     * правим базу в localStorage и перечитываем страницу. patch — строка тела функции (db, arg) => void.
     */
    async patchDb(patchBody, arg) {
      await t.page.waitForTimeout(800);
      await t.page.waitForFunction(() => Boolean(localStorage.getItem('bp-mock-db')), null, { timeout: 20000 }).catch(() => {});
      await t.page.evaluate(
        ({ body, arg }) => {
          const raw = localStorage.getItem('bp-mock-db');
          const wrapped = JSON.parse(raw);
          // eslint-disable-next-line no-new-func
          new Function('db', 'arg', body)(wrapped.state, arg);
          localStorage.setItem('bp-mock-db', JSON.stringify(wrapped));
        },
        { body: patchBody, arg },
      );
      // Перезагрузка без beforeunload-сброса старого состояния: уходим на пустую страницу того же сайта
      await t.page.evaluate(() => {
        window.onbeforeunload = null;
      });
      await t.page.reload({ waitUntil: 'domcontentloaded' });
      await t.settle();
    },

    /** Экран — заглушка раздела («Раздел строится»)? */
    async isPlaceholder() {
      // заглушка раздела: <div data-area-placeholder> («Скоро здесь будет …»); старая — «Раздел строится»
      if (await t.page.locator('[data-area-placeholder]').count()) return true;
      return (await t.text()).includes('Раздел строится');
    },

    /** Вклад раздела в хост ещё заглушка (ExtensionStub → data-ext-stub="<host>:<area>") */
    async isExtStub(scope, area) {
      const root = scope ?? t.page;
      return (await root.locator(area ? `[data-ext-stub$=":${area}"]` : '[data-ext-stub]').count()) > 0;
    },

    /** Открыть экран раздела; если там ещё заглушка — шаг «ждёт раздела <area>» */
    async openOrWait(persona, route, area, why, device = 'desktop') {
      await t.go(persona, route, device);
      if (await t.isPlaceholder()) throw new Pending(area, why ?? `${route.split('?')[0]} — заглушка`);
    },

    async shot(name) {
      fs.mkdirSync(SHOTS, { recursive: true });
      const file = path.join(SHOTS, `${chainId}-${name}.png`);
      await t.page.screenshot({ path: file });
      return path.relative(ROOT, file);
    },
  };
  return t;
}

// ─────────────────────────── Прогон цепочки ───────────────────────────

/** Дев-сервер жив? Ждём до maxMs (его могут перезапускать соседи) */
export async function serverUp(maxMs = 180000) {
  const until = Date.now() + maxMs;
  while (Date.now() < until) {
    const ok = await fetch(`${BASE}/dev/health`, { signal: AbortSignal.timeout(20000) }).then((r) => r.ok).catch(() => false);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

export async function runChain(browser, chain, { log = console.log } = {}) {
  const context = await browser.newContext({
    locale: 'ru-RU',
    timezoneId: 'Asia/Yerevan',
    geolocation: { latitude: 40.1792, longitude: 44.5086 }, // центр Еревана (Кентрон)
    permissions: ['geolocation'],
  });
  const pageErrors = [];
  const state = {};
  const t = makeT(undefined, chain.id, state);
  const openPage = async () => {
    const page = await context.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    page.on('crash', () => {
      pageErrors.push('вкладка упала (page crash)');
      t.crashed = true;
    });
    t.page = page;
  };
  await openPage();
  const results = [];
  const byId = {};

  for (const step of chain.steps) {
    const res = {
      id: step.id,
      title: step.title,
      persona: step.persona,
      area: step.area,
      fids: step.fids ?? [],
      expect: step.expect,
      status: 'pass',
      message: '',
      notes: [],
      shot: undefined,
    };
    const blockedBy = (step.needs ?? []).filter((n) => byId[n] && byId[n].status !== 'pass');
    if (blockedBy.length) {
      res.status = byId[blockedBy[0]].status === 'wait' ? 'wait' : 'skip';
      res.message =
        res.status === 'wait'
          ? `ждёт: сначала нужен шаг ${blockedBy.join(', ')} (${byId[blockedBy[0]].message})`
          : `не прогнан: упал шаг ${blockedBy.join(', ')}`;
    } else if (step.pending) {
      res.status = 'wait';
      res.message = `ждёт раздела ${step.pending}${step.pendingWhy ? ` — ${step.pendingWhy}` : ''}`;
    } else {
      t.notes = [];
      if (t.crashed) {
        await t.page.close().catch(() => {});
        await openPage();
        t.crashed = false;
      }
      const errsBefore = pageErrors.length;
      try {
        try {
          await step.run(t);
        } catch (e) {
          // Сбой инфраструктуры (вкладка упала под нагрузкой, таймаут Playwright) — один повтор на новой вкладке
          const infra = !(e instanceof Fail) && !(e instanceof Pending) && /crash|closed|Timeout \d+ms exceeded/i.test(String(e.message));
          if (!infra) throw e;
          t.note(`повтор шага после сбоя: ${String(e.message).split('\n')[0].slice(0, 120)}`);
          await t.page.close().catch(() => {});
          await openPage();
          t.crashed = false;
          await step.run(t);
        }
        if (pageErrors.length > errsBefore) t.note(`ошибка страницы: ${pageErrors.slice(errsBefore).join(' | ')}`);
      } catch (e) {
        if (!(e instanceof Fail) && !(e instanceof Pending) && /ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|ECONNREFUSED/.test(String(e.message)) && (await serverUp())) {
          // сервер перезапускали — повторяем шаг на живом
          try {
            await t.page.close().catch(() => {});
            await openPage();
            await step.run(t);
            e = undefined;
          } catch (e2) {
            e = e2;
          }
        }
        if (e === undefined) {
          /* повтор удался */
        } else if (!(e instanceof Fail) && !(e instanceof Pending) && /ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|ECONNREFUSED|сборка дев-сервера сломана/.test(String(e.message))) {
          res.status = 'skip';
          res.message = /сборка/.test(String(e.message)) ? 'не прогнан: сборка дев-сервера сломана соседями' : 'не прогнан: дев-сервер недоступен';
        } else if (e instanceof Pending) {
          res.status = 'wait';
          res.message = e.message;
        } else {
          res.status = 'fail';
          res.message = e instanceof Fail ? e.message : `сбой прогона: ${String(e.message ?? e).split('\n')[0].slice(0, 300)}`;
          try {
            res.shot = await t.shot(`${step.id}-fail`);
          } catch {
            /* снимок не удался — не страшно */
          }
        }
      }
      res.notes = [...t.notes];
      if (res.status === 'pass' && step.shot !== false) {
        try {
          res.shot = await t.shot(step.id);
        } catch {
          /* ок */
        }
      }
    }
    byId[step.id] = res;
    results.push(res);
    const icon = { pass: '✅', fail: '❌', wait: '⏳', skip: '⛔' }[res.status];
    log(`  ${icon} ${chain.id}.${step.id} [${step.persona ?? '—'}] ${step.title}${res.message ? ` — ${res.message}` : ''}`);
    for (const n of res.notes) log(`       · ${n}`);
  }
  await context.close().catch(() => {});
  return { id: chain.id, title: chain.title, personas: chain.personas, fids: chain.fids, results };
}
