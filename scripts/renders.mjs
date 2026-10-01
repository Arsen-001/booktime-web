// Замер перерисовок и запросов на главных действиях (Playwright + счётчик коммитов React).
// Дев-сервер: bash scripts/ensure-dev.sh
//
//   node scripts/renders.mjs --label after                 все сценарии, отчёт qa/speed/renders-after.json
//   node scripts/renders.mjs --only journal-status,clients-type --runs 3
//   node scripts/renders.mjs --compare before,after        таблица «до / после» из двух отчётов
//   node scripts/renders.mjs --check-keys                  ключи useApiQuery: один ключ — одна функция
//   node scripts/renders.mjs --check-compiler              «x!.y» в функциях для хуков/пропов (падает под React Compiler)
//   node scripts/renders.mjs --list                        список сценариев
//
// Как меряется. В страницу до React ставится свой __REACT_DEVTOOLS_GLOBAL_HOOK__: на каждый коммит
// обходим дерево волокон и считаем компоненты, которые РЕАЛЬНО отрендерились (флаг PerformedWork,
// как в React DevTools; поддерево, которое React пропустил целиком, не обходится). Плюс счётчики
// window.__bpApiStats из src/api/request.ts: requests — вызовы request(), queries — запуски чтений
// useApiQuery, inflight — сколько запросов в полёте. Действие меряется от клика до «тишины»
// (ни коммитов 700 мс, ни запросов в полёте):
//   renders  — сколько раз отрендерились компоненты (сумма по коммитам; монтирование тоже считается)
//   commits  — сколько раз React что-то применил к странице
//   dom      — сколько изменений DOM (MutationObserver: узлы, атрибуты, текст)
//   requests / queries — сколько вызовов моковой базы / перечитываний запросов
//   feedback — мс до первого коммита (увидел ли человек отклик сразу)
//   result   — мс до видимого результата (у сценария своё условие; нет условия — до тишины)
//   settled  — мс до последнего коммита
// Прогон с Fast Refresh (кто-то сохранил файл) или ошибкой страницы помечается и повторяется.
//
// Параметры:
//   --label <имя>   имя отчёта (по умолчанию run)      --runs 2   прогонов на сценарий (берётся медиана)
//   --only a,b      только эти сценарии                  --base http://localhost:3710
//   --top 12        сколько самых частых компонентов показать
//   --debug         снимок экрана после действия: qa/speed/debug-<сценарий>.png
//   --merge         дописать сценарии в существующий отчёт --label (перемерить упавшие)
//   --mute-hmr      глушить HMR на время действия (переходы router.push в деве тогда не работают)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'qa/speed');

const argv = process.argv.slice(2);
const opts = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const [key, inline] = a.slice(2).split(/=(.*)/s);
  if (inline !== undefined) opts[key] = inline;
  else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) opts[key] = argv[++i];
  else opts[key] = true;
}

if (opts.help || opts.h) {
  const head = [];
  for (const l of fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n')) {
    if (!l.startsWith('//')) break;
    head.push(l.replace(/^\/\/ ?/, ''));
  }
  console.log(head.join('\n'));
  process.exit(0);
}

const BASE = String(opts.base ?? 'http://localhost:3710').replace(/\/$/, '');
const RUNS = Math.max(1, Number(opts.runs ?? 2));
const TOP = Number(opts.top ?? 12);
const DEVICES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};

// ─────────────────────────── Счётчик коммитов (ставится в страницу до React) ───────────────────────────

const HOOK = String.raw`(() => {
  const PERFORMED_WORK = 1; // ReactFiberFlags.PerformedWork
  const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15]); // Function, Class, ForwardRef, Memo, SimpleMemo
  const S = {
    recording: false, t0: 0, lastAny: 0, commits: 0, renders: 0, mounts: 0, updates: 0, dom: 0,
    first: 0, last: 0, names: {}, base: { requests: 0, queries: 0 },
    start() {
      Object.assign(this, { recording: true, t0: performance.now(), commits: 0, renders: 0, mounts: 0, updates: 0, dom: 0, first: 0, last: 0, names: {} });
      const a = window.__bpApiStats || {};
      this.base = { requests: a.requests || 0, queries: a.queries || 0 };
    },
    stop() {
      this.recording = false;
      const a = window.__bpApiStats || {};
      return {
        commits: this.commits, renders: this.renders, mounts: this.mounts, updates: this.updates, dom: this.dom,
        feedback: this.first ? Math.round(this.first - this.t0) : null,
        settled: this.last ? Math.round(this.last - this.t0) : null,
        requests: (a.requests || 0) - this.base.requests, queries: (a.queries || 0) - this.base.queries,
        names: this.names,
      };
    },
  };
  window.__rr = S;
  const nameOf = (f) => {
    const t = f.type;
    if (!t) return 'Anonymous';
    if (typeof t === 'function') return t.displayName || t.name || 'Anonymous';
    if (typeof t === 'object') {
      if (t.displayName) return t.displayName;
      if (t.render) return t.render.displayName || t.render.name || 'ForwardRef';
      if (t.type) return typeof t.type === 'function' ? t.type.displayName || t.type.name || 'Memo' : 'Memo';
    }
    return String(t);
  };
  const walk = (root) => {
    const next = root.current;
    const stack = [[next, next.alternate]];
    while (stack.length) {
      const [nf, pf] = stack.pop();
      if (COMPONENT_TAGS.has(nf.tag)) {
        const mounted = !pf;
        if (mounted || (nf.flags & PERFORMED_WORK) === PERFORMED_WORK) {
          S.renders++;
          if (mounted) S.mounts++; else S.updates++;
          const n = nameOf(nf);
          S.names[n] = (S.names[n] || 0) + 1;
        }
      }
      if (pf && nf.child === pf.child) continue; // поддерево пропущено React целиком
      for (let c = nf.child; c; c = c.sibling) stack.push([c, pf ? c.alternate : null]);
    }
  };
  const hook = {
    renderers: new Map(), supportsFiber: true, isDisabled: false,
    inject(renderer) { const id = this.renderers.size + 1; this.renderers.set(id, renderer); return id; },
    checkDCE() {}, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      const now = performance.now();
      S.lastAny = now;
      if (!S.recording) return;
      S.commits++;
      if (!S.first) S.first = now;
      S.last = now;
      try { walk(root); } catch (e) { S.walkError = String(e); }
    },
  };
  Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', { value: hook, configurable: true, writable: true });
  const observe = () => {
    new MutationObserver((list) => { if (S.recording) S.dom += list.length; }).observe(document.documentElement, {
      subtree: true, childList: true, attributes: true, characterData: true,
    });
  };
  if (document.documentElement) observe(); else document.addEventListener('DOMContentLoaded', observe);
})();`;

// ─────────────────────────── Сценарии ───────────────────────────
// prepare — довести экран до исходного состояния (не меряется); act — само действие (меряется);
// result — условие «результат виден» (функция в странице), необязательно.

const textOf = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel)})].map((e) => e.textContent).join('|')`;

const SCENARIOS = [
  {
    id: 'journal-status',
    title: 'Журнал: смена статуса записи (всплывающая карточка)',
    route: '/biz/journal',
    persona: 'owner',
    device: 'desktop',
    async prepare(page) {
      await page.locator('[data-testid="booking-block"]').first().waitFor({ timeout: 60000 });
      await page.locator('button[title="Статус и оплата"]').first().click();
      await page.locator('[role="dialog"] button').first().waitFor();
      // Цель — первая кнопка статуса, которая сейчас не выбрана
      const target = await page.evaluate(() => {
        const names = ['Пришёл', 'Не пришёл', 'Клиент подтвердил', 'Записан'];
        const btns = [...document.querySelectorAll('[role="dialog"] button')];
        for (const n of names) {
          const b = btns.find((x) => x.textContent.trim() === n);
          if (b && !b.className.split(/\s+/).includes('bg-primary')) return n;
        }
        return null;
      });
      if (!target) throw new Error('нет кнопки статуса');
      // Статус виден в блоке сетки значком на кнопке карточки — ждём, когда он сменится
      const icon = await page.evaluate(() => document.querySelector('button[title="Статус и оплата"]').innerHTML);
      return { target, icon };
    },
    async act(page, s) {
      await page.locator('[role="dialog"] button', { hasText: s.target }).first().click();
    },
    result: (s) => `document.querySelector('button[title="Статус и оплата"]')?.innerHTML !== ${JSON.stringify(s.icon)}`,
  },
  {
    id: 'journal-day',
    title: 'Журнал: следующий день',
    route: '/biz/journal',
    persona: 'owner',
    device: 'desktop',
    async prepare(page) {
      await page.locator('[data-testid="booking-block"]').first().waitFor({ timeout: 60000 });
      return { before: await page.evaluate(textOf('[data-testid="booking-block"]')) };
    },
    async act(page) {
      // День — кликом в мини-календаре (так мерили «до»: кнопка «Следующий день» тогда не листала
      // при поясе UTC+, раздел это уже исправил).
      const label = await page.evaluate(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
      });
      await page.locator(`button[aria-label^="${label}"]:visible`).first().click();
    },
    result: (s) => `(() => { const now = ${textOf('[data-testid="booking-block"]')}; return now !== ${JSON.stringify(s.before)} && !document.querySelector('[data-skeleton]'); })()`,
  },
  {
    id: 'clients-type',
    title: 'Клиенты: ввод 5 букв в поиск',
    route: '/biz/clients',
    persona: 'owner',
    device: 'desktop',
    async prepare(page) {
      await page.locator('input[placeholder^="Поиск (по имени"]').waitFor({ timeout: 60000 });
      await page.locator('tbody tr').first().waitFor({ timeout: 60000 });
      return {};
    },
    async act(page) {
      await page.locator('input[placeholder^="Поиск (по имени"]').pressSequentially('Арам ', { delay: 60 });
    },
    result: () => `document.querySelector('input[placeholder^="Поиск (по имени"]').value === 'Арам '`,
  },
  {
    id: 'clients-search',
    title: 'Клиенты: «Найти» по введённому',
    route: '/biz/clients',
    persona: 'owner',
    device: 'desktop',
    async prepare(page) {
      await page.locator('tbody tr').first().waitFor({ timeout: 60000 });
      await page.locator('input[placeholder^="Поиск (по имени"]').fill('Арам');
      return { before: await page.evaluate(textOf('tbody tr')) };
    },
    async act(page) {
      await page.locator('button[aria-label="Найти клиентов"]:visible').first().click();
    },
    result: (s) => `${textOf('tbody tr')} !== ${JSON.stringify(s.before)}`,
  },
  {
    id: 'clients-switch',
    title: 'Клиенты: переключатель (запись в базу на большом экране)',
    route: '/biz/clients',
    persona: 'owner',
    device: 'desktop',
    async prepare(page) {
      await page.locator('tbody tr').first().waitFor({ timeout: 60000 });
      await page.locator('details summary', { hasText: /чат/i }).first().click();
      const sw = page.locator('[role="switch"]:visible').first();
      await sw.waitFor();
      return { before: await sw.getAttribute('aria-checked') };
    },
    async act(page) {
      await page.locator('[role="switch"]:visible').first().click();
    },
    result: (s) => `[...document.querySelectorAll('[role="switch"]')].some((x) => x.offsetParent && x.getAttribute('aria-checked') !== ${JSON.stringify(s.before)})`,
  },
  {
    id: 'schedule-busy',
    title: 'График: отметить занято 12:00–13:00',
    route: '/biz/schedule/calendar',
    persona: 'individual',
    device: 'desktop',
    async prepare(page) {
      const mark = page.getByRole('button', { name: 'Отметить занято' }).first();
      await mark.waitFor({ timeout: 60000 });
      // «с» и «до» — два TimePicker в той же строке, что и кнопка
      const pickers = mark.locator('xpath=..').locator('button[aria-haspopup="listbox"]');
      await pickers.nth(0).click();
      await page.getByRole('option', { name: '12:00', exact: true }).click();
      await pickers.nth(1).click();
      await page.getByRole('option', { name: '13:00', exact: true }).click();
      return {};
    },
    async act(page) {
      await page.getByRole('button', { name: 'Отметить занято' }).first().click();
    },
    result: () => `[...document.querySelectorAll('button[aria-label]')].some((b) => b.getAttribute('aria-label').startsWith('12:00–13:00'))`,
  },
  {
    id: 'client-book',
    title: 'Приложение: клиент подтверждает запись',
    route: '/book?staff=st_nuri_ani',
    persona: 'client',
    device: 'phone',
    async prepare(page) {
      await page.getByText('Маникюр классический').first().click({ timeout: 60000 });
      await page.getByRole('button', { name: 'Продолжить' }).click();
      // Второй доступный день и первое окно в нём
      const days = page.locator('button', { hasText: /^(пн|вт|ср|чт|пт|сб|вс), / });
      await days.first().waitFor();
      await days.nth(1).click();
      await page.locator('button', { hasText: /^\d\d:\d\d$/ }).first().click();
      await page.getByRole('button', { name: 'Подтвердить запись' }).waitFor();
      return {};
    },
    async act(page) {
      await page.getByRole('button', { name: 'Подтвердить запись' }).click();
    },
    result: () => `location.pathname === '/bookings' && !document.querySelector('[data-skeleton]') && !document.querySelector('[aria-busy="true"]')`,
  },
  {
    id: 'catalog-filter',
    title: 'Каталог: фильтр «Свободно сегодня»',
    route: '/search',
    persona: 'client',
    device: 'desktop',
    async prepare(page) {
      await page.locator('a[href^="/masters/"]').first().waitFor({ timeout: 60000 });
      const chip = page.getByRole('button', { name: 'Свободно сегодня' });
      if (!(await chip.isVisible())) await page.getByRole('button', { name: /^Фильтры/ }).first().click();
      await chip.waitFor();
      return { before: await page.evaluate(textOf('a[href^="/masters/"]')) };
    },
    async act(page) {
      await page.getByRole('button', { name: 'Свободно сегодня' }).click();
    },
    result: (s) => `${textOf('a[href^="/masters/"]')} !== ${JSON.stringify(s.before)} && !document.querySelector('[aria-busy="true"]')`,
  },
  {
    id: 'services-cell',
    title: 'Услуги: цена одной строки прямо в таблице (Enter)',
    route: '/biz/services',
    persona: 'owner',
    device: 'desktop',
    async prepare(page) {
      const row = page.locator('[data-service-row="sv_nuri_men"]');
      await row.waitFor({ timeout: 60000 });
      await row.getByRole('button', { name: /^Цена/ }).click();
      const input = row.locator('input[inputmode]').first();
      await input.waitFor();
      const next = String(6000 + Math.floor(Math.random() * 90) * 10);
      await input.fill(next);
      return { next };
    },
    async act(page) {
      await page.keyboard.press('Enter');
    },
    result: (s) => `document.querySelector('[data-service-row="sv_nuri_men"]')?.innerText.replace(/\\s/g, '').includes(${JSON.stringify(s.next)})`,
  },
  {
    id: 'services-online',
    title: 'Услуги: тумблер «Онлайн» в строке',
    route: '/biz/services',
    persona: 'owner',
    device: 'desktop',
    async prepare(page) {
      const sw = page.locator('[data-service-row="sv_nuri_kids"] [role="switch"]');
      await sw.waitFor({ timeout: 60000 });
      return { before: await sw.getAttribute('aria-checked') };
    },
    async act(page) {
      await page.locator('[data-service-row="sv_nuri_kids"] [role="switch"]').click();
    },
    result: (s) => `document.querySelector('[data-service-row="sv_nuri_kids"] [role="switch"]')?.getAttribute('aria-checked') !== ${JSON.stringify(s.before)}`,
  },
  {
    id: 'services-bulk',
    title: 'Услуги: массово «Онлайн выкл.» у двух отмеченных',
    route: '/biz/services',
    persona: 'owner',
    device: 'desktop',
    async prepare(page) {
      await page.locator('[data-service-row="sv_nuri_classic"]').waitFor({ timeout: 60000 });
      for (const id of ['sv_nuri_classic', 'sv_nuri_hardware']) {
        const sw = page.locator(`[data-service-row="${id}"] [role="switch"]`);
        if ((await sw.getAttribute('aria-checked')) === 'false') {
          await sw.click();
          await page.waitForTimeout(800);
        }
        await page.locator(`[data-service-row="${id}"] [role="checkbox"], [data-service-row="${id}"] input[type="checkbox"]`).first().check();
      }
      await page.locator('[data-bulk-action-bar]').waitFor();
      return {};
    },
    async act(page) {
      await page.locator('[data-bulk-action-bar]').getByRole('button', { name: /Онлайн выкл/ }).click();
    },
    result: () => `document.querySelector('[data-service-row="sv_nuri_hardware"] [role="switch"]')?.getAttribute('aria-checked') === 'false'`,
  },
];

// ─────────────────────────── Прогон ───────────────────────────

function median(values) {
  const v = values.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.floor((v.length - 1) / 2)];
}

async function waitQuiet(page, quietMs = 700, maxMs = 15000) {
  await page
    .waitForFunction(
      (q) => performance.now() - (window.__rr?.lastAny ?? 0) > q && !((window.__bpApiStats?.inflight ?? 0) > 0),
      quietMs,
      { timeout: maxMs, polling: 100 },
    )
    .catch(() => {});
}

function buildUrl(sc) {
  const sep = sc.route.includes('?') ? '&' : '?';
  return `${BASE}${sc.route}${sep}demo=${sc.persona}&sphere=${sc.sphere ?? 'nails'}&lang=ru&theme=light&api=normal`;
}

async function runOnce(browser, sc) {
  const context = await browser.newContext({ ...DEVICES[sc.device ?? 'desktop'], locale: 'ru-RU' });
  await context.addInitScript(HOOK);
  const page = await context.newPage();
  // Горячая перезагрузка от чужих правок (6 сборщиков сохраняют файлы) портит замер: такой прогон
  // помечается и повторяется. --mute-hmr глушит сообщения HMR на время действия (но тогда в деве
  // не работает переход по router.push — сценарии с переходом не пройдут).
  let muteHmr = false;
  await page.routeWebSocket(/\/_next\/(webpack-)?hmr/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((message) => {
      if (!muteHmr) ws.send(message);
    });
    ws.onMessage((message) => server.send(message));
  });
  const problems = [];
  let tainted = false;
  page.on('console', (m) => {
    const text = m.text();
    if (/Fast Refresh|\[HMR\]/.test(text) && !/connected/.test(text)) tainted = tainted || text.slice(0, 60);
    if (m.type() === 'error' && !/WebSocket|_next\/hmr/.test(text)) problems.push(text.slice(0, 200));
  });
  page.on('pageerror', (e) => problems.push(String(e).slice(0, 200)));

  try {
    await page.goto(buildUrl(sc), { waitUntil: 'networkidle', timeout: 180000 });
    await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
    const state = (await sc.prepare(page)) ?? {};
    await waitQuiet(page, 900, 20000);
    muteHmr = Boolean(opts['mute-hmr']);
    tainted = false;
    await page.evaluate(() => window.__rr.start());
    const t0 = Date.now();
    await sc.act(page, state);
    let result = null;
    if (sc.result) {
      try {
        await page.waitForFunction(sc.result(state), null, { timeout: 15000, polling: 'raf' });
        result = await page.evaluate(() => Math.round(performance.now() - window.__rr.t0));
      } catch {
        problems.push('результат не дождался за 15 с');
      }
    }
    await waitQuiet(page);
    // Страница перезагрузилась целиком (Fast Refresh сдался) — счётчик новый, прогон не считается
    if (!(await page.evaluate(() => window.__rr.recording))) tainted = tainted || 'страница перезагрузилась';
    const m = await page.evaluate(() => window.__rr.stop());
    if (opts.debug) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(OUT_DIR, `debug-${sc.id}.png`) });
      console.log(`    [debug] ${sc.id}: ${page.url()} · снимок qa/speed/debug-${sc.id}.png`);
    }
    m.result = result ?? m.settled;
    m.wall = Date.now() - t0;
    return { ...m, tainted, problems };
  } finally {
    await context.close();
  }
}

async function measure() {
  const { chromium } = await import('@playwright/test');
  const health = await fetch(`${BASE}/dev/health`).then((r) => r.ok).catch(() => false);
  if (!health) {
    console.error(`Сервер ${BASE} не отвечает — bash scripts/ensure-dev.sh`);
    process.exit(1);
  }
  const only = opts.only ? String(opts.only).split(',') : undefined;
  const list = SCENARIOS.filter((s) => !only || only.includes(s.id));
  const label = String(opts.label ?? 'run');
  let browser = await chromium.launch();
  const file = path.join(OUT_DIR, `renders-${label}.json`);
  // --merge: дописать/заменить сценарии в уже существующем отчёте (например, перемерить упавшие)
  const report =
    opts.merge && fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, 'utf8'))
      : { label, at: new Date().toISOString(), base: BASE, runs: RUNS, scenarios: [] };
  const put = (row) => {
    const i = report.scenarios.findIndex((x) => x.id === row.id);
    if (i >= 0) report.scenarios[i] = row;
    else report.scenarios.push(row);
  };
  try {
    for (const sc of list) {
      const runs = [];
      let attempts = 0;
      while (runs.length < RUNS && attempts < RUNS + 6) {
        attempts++;
        try {
          // Chromium упал (тяжёлая страница, чужая перезагрузка) — новый браузер, а не каскад ошибок
          if (!browser.isConnected()) browser = await chromium.launch();
          const r = await runOnce(browser, sc);
          if (r.tainted) {
            console.log(`  ${sc.id}: прогон задет горячей перезагрузкой (${r.tainted}) — повтор`);
            continue;
          }
          runs.push(r);
        } catch (e) {
          console.log(`  ${sc.id}: прогон упал — ${String(e.message ?? e).split('\n')[0]}`);
        }
      }
      if (!runs.length) {
        put({ id: sc.id, title: sc.title, failed: true });
        console.log(`✗ ${sc.id} — не удалось измерить`);
        continue;
      }
      const pick = (k) => median(runs.map((r) => r[k]));
      const names = {};
      for (const r of runs) for (const [n, c] of Object.entries(r.names)) names[n] = (names[n] ?? 0) + c / runs.length;
      const top = Object.entries(names)
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP)
        .map(([n, c]) => `${n}×${Math.round(c * 10) / 10}`);
      const row = {
        id: sc.id,
        title: sc.title,
        renders: pick('renders'),
        mounts: pick('mounts'),
        updates: pick('updates'),
        commits: pick('commits'),
        dom: pick('dom'),
        requests: pick('requests'),
        queries: pick('queries'),
        feedback: pick('feedback'),
        result: pick('result'),
        settled: pick('settled'),
        uniqueComponents: Object.keys(names).length,
        top,
        problems: [...new Set(runs.flatMap((r) => r.problems))].slice(0, 5),
        raw: runs.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'names'))),
      };
      put(row);
      console.log(
        `✓ ${sc.id.padEnd(15)} renders ${String(row.renders).padStart(5)}  commits ${String(row.commits).padStart(3)}  dom ${String(row.dom).padStart(5)}  ` +
          `requests ${String(row.requests).padStart(3)}  queries ${String(row.queries).padStart(3)}  feedback ${row.feedback ?? '—'} мс  result ${row.result ?? '—'} мс  settled ${row.settled ?? '—'} мс`,
      );
      console.log(`    топ: ${row.top.join(', ')}`);
      if (row.problems.length) console.log(`    замечания: ${row.problems.join(' · ')}`);
    }
  } finally {
    await browser.close().catch(() => {});
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`\nОтчёт: ${path.relative(ROOT, file)}`);
}

// ─────────────────────────── Сравнение ───────────────────────────

function compare() {
  const [a, b] = String(opts.compare).split(',');
  const load = (l) => JSON.parse(fs.readFileSync(path.join(OUT_DIR, `renders-${l}.json`), 'utf8'));
  const A = load(a);
  const B = load(b);
  const cols = ['renders', 'commits', 'dom', 'requests', 'queries', 'feedback', 'result', 'settled'];
  const lines = [`| Действие | ${cols.map((c) => `${c} ${a} → ${b}`).join(' | ')} |`, `|---|${cols.map(() => '---').join('|')}|`];
  for (const rb of B.scenarios) {
    const ra = A.scenarios.find((x) => x.id === rb.id);
    if (!ra) continue;
    const cell = (k) => `${ra[k] ?? '—'} → **${rb[k] ?? '—'}**`;
    lines.push(`| ${rb.title} | ${cols.map(cell).join(' | ')} |`);
  }
  console.log(lines.join('\n'));
}

// ─────────────────────────── Проверка ключей ───────────────────────────
// Кэш общий: один и тот же ключ из двух мест должен означать одни и те же данные. Ищем вызовы
// useApiQuery с одинаковыми строковыми частями ключа, но разными функциями чтения.

async function checkKeys() {
  const { default: ts } = await import('typescript');
  const files = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(f)) files.push(p);
    }
  })(path.join(ROOT, 'src'));
  const calls = [];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes('useApiQuery(')) continue;
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (n) => {
      if (ts.isCallExpression(n) && n.expression.getText(sf) === 'useApiQuery' && n.arguments.length >= 2) {
        const [k, f] = n.arguments;
        const shape = ts.isArrayLiteralExpression(k)
          ? k.elements.map((e) => (ts.isStringLiteral(e) ? JSON.stringify(e.text) : '_')).join(',')
          : `?${k.getText(sf)}`;
        // Имя вызываемой функции api — то, что определяет форму данных
        const callee = (() => {
          if (ts.isIdentifier(f)) return f.text;
          let found;
          const find = (x) => {
            if (found) return;
            if (ts.isCallExpression(x)) found = x.expression.getText(sf);
            else ts.forEachChild(x, find);
          };
          find(f);
          return found ?? f.getText(sf).slice(0, 40);
        })();
        const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        calls.push({ where: `${path.relative(ROOT, file)}:${line}`, shape, callee, dynamic: !ts.isArrayLiteralExpression(k) || !k.elements.length || !ts.isStringLiteral(k.elements[0]) });
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  const byShape = new Map();
  for (const c of calls) byShape.set(c.shape, [...(byShape.get(c.shape) ?? []), c]);
  let bad = 0;
  for (const [shape, list] of byShape) {
    const callees = new Set(list.map((c) => c.callee));
    if (callees.size > 1) {
      bad++;
      console.log(`✗ ключ [${shape}] читают разные функции:`);
      for (const c of list) console.log(`    ${c.where}  ${c.callee}`);
    }
  }
  const dynamic = calls.filter((c) => c.dynamic);
  for (const c of dynamic) console.log(`! ${c.where}: ключ не начинается со строки — добавьте имя раздела первым элементом`);
  console.log(`\nВызовов useApiQuery: ${calls.length}, разных ключей: ${byShape.size}, конфликтов: ${bad}, без строкового начала: ${dynamic.length}`);
  process.exit(bad ? 1 : 0);
}

// ─────────────────────────── Проверка под React Compiler ───────────────────────────
// Компилятор считает функцию, переданную в хук (useApiQuery(key, () => …)) или в проп JSX
// (onClick={() => …}), «может быть вызвана в рендере» и выносит её обращения к полям В РЕНДЕР — для
// сравнения мемо-кэша. `x!.y` внутри такой функции превращается в `x.y` прямо в рендере и падает, пока
// x ещё undefined/null (enabled: false не спасает). Ищем такие места: `a!.b` внутри стрелки-аргумента
// хука или стрелки-пропа JSX.

async function checkCompiler() {
  const { default: ts } = await import('typescript');
  const files = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(f)) files.push(p);
    }
  })(path.join(ROOT, 'src'));
  const hits = [];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes('!.') && !src.includes('!)')) continue;
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const isFn = (n) => ts.isArrowFunction(n) || ts.isFunctionExpression(n);
    // Функция передана в хук или в проп JSX?
    const riskyHost = (fn) => {
      const p = fn.parent;
      if (ts.isCallExpression(p) && p.arguments.includes(fn) && /^use[A-Z]/.test(p.expression.getText(sf).split('.').pop())) return p.expression.getText(sf);
      if (ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent)) return `${p.parent.name.getText(sf)}={…}`;
      return null;
    };
    const visit = (n, host) => {
      if (isFn(n)) host = riskyHost(n) ?? host;
      if (host && ts.isNonNullExpression(n) && (ts.isPropertyAccessExpression(n.parent) || ts.isElementAccessExpression(n.parent)) && n.parent.expression === n) {
        // Только «x!.поле»: голое businessId! не опасно — в рендере сравнивается само значение
        const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        hits.push(`${path.relative(ROOT, file)}:${line}  ${n.parent.getText(sf).slice(0, 60)}  (в ${host})`);
      }
      ts.forEachChild(n, (c) => visit(c, host));
    };
    visit(sf, null);
  }
  for (const h of hits) console.log(`✗ ${h}`);
  console.log(`\nОпасных «x!.y» в функциях для хуков и пропов: ${hits.length}. Исправление: вычислить значение в рендере`);
  console.log(`через ?. (const id = row?.business.id) и в функции взять его: () => load(id ?? '').`);
  process.exit(hits.length ? 1 : 0);
}

if (opts.list) {
  for (const s of SCENARIOS) console.log(`${s.id.padEnd(16)} ${s.title}  (${s.route}, ${s.persona}, ${s.device})`);
} else if (opts['check-keys']) {
  await checkKeys();
} else if (opts['check-compiler']) {
  await checkCompiler();
} else if (opts.compare) {
  compare();
} else {
  await measure();
}
