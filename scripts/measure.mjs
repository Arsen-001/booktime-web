// Замер экранов через Playwright (headless Chromium). Дев-сервер: bash scripts/ensure-dev.sh
//
//   node scripts/measure.mjs --area journal
//   node scripts/measure.mjs --routes /,/biz --persona client,owner --lang ru,hy --device phone,desktop
//   node scripts/measure.mjs --scenario qa/scenarios/journal-create.json
//
// Параметры (списки — через запятую; каждая комбинация = отдельная страница в новом контексте браузера):
//   --area <id>          маршруты раздела берутся с сервера (GET /dev/routes); снимки в qa/shots/<id>/
//   --routes /a,/b       явные маршруты (можно вместе с --area)
//   --persona owner      guest | client | individual | owner | admin | master | network | platform
//                        | owner-empty | individual-empty — пустой бизнес («Новый салон / Новый мастер — пусто»):
//                        без услуг, мастеров, клиентов и записей, для проверки пустых состояний
//   --sphere nails       nails | barber | hair | cosmetology | massage | dental | fitness | carwash | general
//   --lang ru            ru | hy | en
//   --theme light        light | dark
//   --device phone,desktop   phone = 390×844 (x2, touch), desktop = 1440×900; маленькие телефоны
//                        (только по запросу): phone-sm = 360×740 (Android), phone-se = 375×667 (iPhone SE)
//   --query "api=slow"   добавить к адресу свои параметры (например api=error, font=large)
//   --scenario file.json сценарий кликов (см. ниже); маршрут и персона берутся из файла
//   --out <dir>          папка снимков (по умолчанию qa/shots/<area|custom>)
//   --json <path>        куда записать JSON-отчёт (по умолчанию <out>/report.json)
//   --full               кроме снимка видимой области сохранить и всю страницу (…__full.png)
//   --show-demo          не прятать плавающую демо-кнопку [data-demo-fab]
//   --concurrency 3      сколько страниц мерить одновременно
//   --base http://localhost:3710
//
// Что меряется на каждой странице: ошибки и предупреждения консоли, ошибки страницы (pageerror),
// ответы ≥ 400, сообщения i18n ([i18n:missing], [i18n:no-en], число [i18n:fallback-ru]), «сырые ключи»
// на экране (namespace.key и «⋯»), горизонтальный вылет, мелкие зоны нажатия (телефон, touch — < 40 px; десктоп,
// мышь — < 36 px: кнопки src/ui с md по 36 px, см. CONVENTIONS §10), найденные data-f,
// для hy — чем нарисованы армянские буквы (должен быть веб-шрифт Noto Sans Armenian), «висит загрузка»
// (скелетоны/aria-busy дольше 8 с; внутри [data-showcase] не считаются).
//
// Сценарий (JSON-объект или массив объектов):
//   { "route": "/biz/journal", "persona": "owner", "sphere": "nails", "lang": "ru", "theme": "light",
//     "device": "desktop",
//     "steps": [ {"click": "role=button[name=\"Новая запись\"]"}, {"fill": "input[name=phone]", "value": "00123456"},
//                {"press": "Enter"}, {"expectText": "Запись создана"}, {"expectVisible": "[data-f=\"F-01-024\"]"},
//                {"wait": 500}, {"screenshot": "after-save"}, {"goto": "/biz/records"} ] }
//   Селекторы — CSS или движки Playwright: text=…, role=button[name="…"]. Шаг упал → снимок и остановка.
//
// Код выхода 0 всегда (это замер), кроме ошибки запуска (сервер не отвечает, нет браузера).
import fs from 'node:fs';
import { acquireBrowserSlot } from './pw-slots.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ─────────────────────────── Аргументы ───────────────────────────
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
  const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  // Справка — только первый блок комментариев в начале файла
  const head = [];
  for (const l of src.split('\n')) {
    if (!l.startsWith('//')) break;
    head.push(l.replace(/^\/\/ ?/, ''));
  }
  console.log(head.join('\n'));
  process.exit(0);
}

const list = (v, def) => (v === undefined || v === true ? def : String(v).split(',').map((s) => s.trim()).filter(Boolean));
const BASE = String(opts.base ?? 'http://localhost:3710').replace(/\/$/, '');
const DEVICES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'phone-sm': { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  'phone-se': { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};
const LOCALES = { ru: 'ru-RU', hy: 'hy-AM', en: 'en-US' };
const CONCURRENCY = Math.max(1, Number(opts.concurrency ?? 3));
const LOAD_TIMEOUT = 8000;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function fetchAreaRoutes(area) {
  let res;
  try {
    res = await fetch(`${BASE}/dev/routes`);
  } catch {
    fail(`сервер ${BASE} не отвечает — запустите: bash scripts/ensure-dev.sh`);
  }
  if (!res.ok) fail(`GET /dev/routes → ${res.status}`);
  const data = await res.json();
  const routes = data.areas?.[area];
  if (!routes) fail(`раздела «${area}» нет в /dev/routes. Есть: ${Object.keys(data.areas ?? {}).join(', ')}`);
  return routes;
}

function slugify(route) {
  const clean = route.split('?')[0].replace(/^\/+|\/+$/g, '');
  return clean ? clean.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') : 'home';
}

/** Персоны замера → демо-параметры адреса: 'owner-empty' = ?demo=owner&empty=1 (src/demo/settings.ts) */
function personaParams(persona) {
  const m = /^(owner|individual)-empty$/.exec(persona);
  return m ? { demo: m[1], empty: '1' } : { demo: persona, empty: '0' };
}

function buildUrl(route, combo) {
  const params = new URLSearchParams({ ...personaParams(combo.persona), sphere: combo.sphere, lang: combo.lang, theme: combo.theme });
  const extra = typeof opts.query === 'string' ? opts.query : '';
  const qs = params.toString() + (extra ? `&${extra.replace(/^[?&]/, '')}` : '');
  return `${BASE}${route}${route.includes('?') ? '&' : '?'}${qs}`;
}

// ─────────────────────────── Что меряем в странице ───────────────────────────
// Код двух функций ниже выполняется в браузере (page.evaluate)
/** Порог зоны нажатия: палец (touch) — 40 px, мышь — 36 px (CONVENTIONS §10 «Зоны нажатия») */
const minTapFor = (device) => (device.hasTouch ? 40 : 36);

function inPageMeasure(minTap = 40) {
  const visible = (el) => {
    if (!el || !el.getClientRects().length) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
    // Спрятано для экранных дикторов (sr-only): clip-path inset(50%) / clip rect(0 0 0 0)
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.clipPath === 'inset(50%)' || /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(ps.clip)) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const hint = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    const df = el.closest('[data-f]')?.getAttribute('data-f');
    return `${el.tagName.toLowerCase()}${id}${cls === '.' ? '' : cls}${df ? ` in [data-f=${df}]` : ''}`;
  };
  const textOf = (el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 60);

  // Сырые ключи i18n и «⋯»
  const rawKeys = [];
  const keyRe = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_-]+)+$/;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const armenianNodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (!text) continue;
    const parent = node.parentElement;
    if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName) || !visible(parent)) continue;
    if ((keyRe.test(text) && !/^\d/.test(text) && !/\.(png|jpe?g|svg|com|am|ru)$/i.test(text)) || text === '⋯') {
      if (rawKeys.length < 30) rawKeys.push({ text, where: hint(parent) });
    }
    const arm = (text.match(/[Ա-֏]/g) || []).length;
    if (arm >= 3 && arm / text.replace(/\s/g, '').length >= 0.5) armenianNodes.push(parent);
  }

  // Горизонтальный вылет. На телефоне (isMobile) слишком широкий контент расширяет само окно
  // (innerWidth 374 при экране 360) — поэтому сверяем с шириной экрана, а не только с innerWidth.
  const innerWidth = Math.min(window.innerWidth, screen.width);
  const scrollWidth = document.documentElement.scrollWidth;
  const pageOverflow = scrollWidth > innerWidth + 1;
  const offenders = [];
  if (pageOverflow) {
    const clipped = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
      }
      return false;
    };
    for (const el of document.body.querySelectorAll('*')) {
      if (offenders.length >= 10) break;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > innerWidth + 1 && visible(el) && !clipped(el)) {
        offenders.push({ el: hint(el), right: Math.round(r.right), width: Math.round(r.width) });
      }
    }
  }

  // Зоны нажатия меньше порога (40 px на телефоне, 36 px на десктопе)
  const smallTargets = [];
  const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=menuitem], [role=switch], [role=checkbox], [role=radio], [role=option]';
  const seen = new Set();
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[data-demo-fab]')) continue;
    let target = el;
    if (el.tagName === 'INPUT' && ['checkbox', 'radio'].includes(el.type)) {
      // Нажимается вся подпись (<label>) — меряем её, а не сам квадратик
      target = el.labels?.[0] || el.closest('label') || el;
    }
    if (seen.has(target) || !visible(target)) continue;
    seen.add(target);
    const r = target.getBoundingClientRect();
    // Зону нажатия может расширять невидимый ::before (полоса перерыва в журнале: before:h-10 при 16 px самой полосы)
    const before = getComputedStyle(target, '::before');
    const hitW = before.content !== 'none' && before.position === 'absolute' ? Math.max(r.width, parseFloat(before.width) || 0) : r.width;
    const hitH = before.content !== 'none' && before.position === 'absolute' ? Math.max(r.height, parseFloat(before.height) || 0) : r.height;
    if (hitW < minTap || hitH < minTap) {
      const inline = getComputedStyle(target).display === 'inline';
      smallTargets.push({ el: hint(target), text: textOf(target), w: Math.round(r.width), h: Math.round(r.height), inline });
    }
  }

  // data-f
  const dataF = [...new Set([...document.querySelectorAll('[data-f]')].flatMap((el) => el.getAttribute('data-f').split(/\s+/).filter(Boolean)))].sort();

  // Для проверки армянского шрифта — пометить до 3 элементов
  armenianNodes.slice(0, 3).forEach((el, i) => el.setAttribute('data-measure-arm', String(i + 1)));

  return {
    title: document.title,
    rawKeys,
    overflow: { pageOverflow, scrollWidth, innerWidth, offenders },
    smallTargets: smallTargets.slice(0, 20),
    smallTargetsTotal: smallTargets.length,
    dataF,
    armenianMarked: Math.min(3, armenianNodes.length),
  };
}

function inPageLoadingDone() {
  const visible = (el) => {
    if (!el.getClientRects().length) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  };
  // [data-showcase] — витрина UI: там скелетоны показаны нарочно
  return ![...document.querySelectorAll('[data-skeleton], [aria-busy="true"]')].some((el) => !el.closest('[data-showcase]') && visible(el));
}

async function waitLoaded(page) {
  try {
    await page.waitForFunction(inPageLoadingDone, null, { timeout: LOAD_TIMEOUT, polling: 200 });
    return false;
  } catch {
    return true;
  }
}

async function checkArmenianFont(page, marked) {
  if (!marked) return { checked: false, ok: false, reason: 'на экране нет армянского текста', fonts: [] };
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-measure-arm]' });
    const samples = [];
    for (const nodeId of nodeIds) {
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      samples.push(fonts.map((f) => ({ family: f.familyName, custom: f.isCustomFont, glyphs: f.glyphCount })));
    }
    const ok = samples.length > 0 && samples.every((fonts) => fonts.some((f) => f.custom && /Noto Sans Armenian/i.test(f.family) && f.glyphs > 0));
    const names = [...new Set(samples.flat().map((f) => `${f.family}${f.custom ? ' (веб)' : ' (система)'}`))];
    return { checked: true, ok, fonts: names };
  } catch (e) {
    return { checked: false, ok: false, reason: `CDP: ${e.message}`, fonts: [] };
  } finally {
    await cdp.detach().catch(() => {});
  }
}

async function runStep(page, step, combo, shot) {
  // Только видимые: адаптивная вёрстка держит в DOM копии (меню десктопа скрыто на телефоне)
  const loc = (sel) => page.locator(sel).filter({ visible: true }).first();
  if (step.click) {
    await loc(step.click).click({ timeout: 8000 });
    await page.waitForTimeout(150);
    await waitLoaded(page);
  } else if (step.fill) {
    await loc(step.fill).fill(String(step.value ?? ''), { timeout: 8000 });
  } else if (step.press) {
    if (step.selector) await loc(step.selector).press(step.press);
    else await page.keyboard.press(step.press);
    await page.waitForTimeout(150);
  } else if (step.expectText) {
    await page.getByText(step.expectText, { exact: false }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 8000 });
  } else if (step.expectVisible) {
    await loc(step.expectVisible).waitFor({ state: 'visible', timeout: 8000 });
  } else if (step.wait) {
    await page.waitForTimeout(Number(step.wait));
  } else if (step.screenshot) {
    return await shot(step.screenshot);
  } else if (step.goto) {
    await page.goto(buildUrl(step.goto, combo), { waitUntil: 'networkidle', timeout: 120000 });
    await waitLoaded(page);
  } else {
    throw new Error(`неизвестный шаг: ${JSON.stringify(step)}`);
  }
  return undefined;
}

async function measure(browser, job, outDir) {
  const { route, combo, steps } = job;
  const device = DEVICES[combo.device];
  if (!device) throw new Error(`неизвестное устройство ${combo.device}`);
  const context = await browser.newContext({ ...device, locale: LOCALES[combo.lang] ?? 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const page = await context.newPage();
  const result = {
    route,
    url: buildUrl(route, combo),
    ...combo,
    status: null,
    loadMs: 0,
    stuckLoading: false,
    console: { errors: [], warnings: [] },
    i18n: { missing: [], noEn: [], fallbackRu: 0 },
    pageErrors: [],
    badResponses: [],
    rawKeys: [],
    overflow: null,
    smallTargets: [],
    smallTargetsTotal: 0,
    dataF: [],
    armenianFont: null,
    scenario: null,
    screenshots: [],
  };

  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    if (text.startsWith('[i18n:missing]')) result.i18n.missing.push(text);
    else if (text.startsWith('[i18n:no-en]')) result.i18n.noEn.push(text);
    else if (text.startsWith('[i18n:fallback-ru]')) result.i18n.fallbackRu++;
    else if (type === 'error') result.console.errors.push(text.slice(0, 500));
    else if (type === 'warning') result.console.warnings.push(text.slice(0, 500));
  });
  page.on('pageerror', (err) => result.pageErrors.push(String(err?.stack || err).slice(0, 800)));
  page.on('response', (res) => {
    if (res.status() >= 400) result.badResponses.push({ url: res.url(), status: res.status() });
  });
  page.on('requestfailed', (req) => {
    const reason = req.failure()?.errorText ?? '';
    if (!/ERR_ABORTED|NS_BINDING_ABORTED/.test(reason)) result.badResponses.push({ url: req.url(), status: `failed: ${reason}` });
  });

  const base = `${slugify(route)}__${combo.persona}-${combo.sphere}-${combo.lang}-${combo.theme}-${combo.device}`;
  const shot = async (suffix, full = false) => {
    const file = path.join(outDir, `${base}${suffix ? `__${suffix}` : ''}.png`);
    await page.screenshot({ path: file, fullPage: full });
    const rel = path.relative(ROOT, file);
    result.screenshots.push(rel);
    return rel;
  };

  try {
    const t0 = Date.now();
    const response = await page.goto(result.url, { waitUntil: 'networkidle', timeout: 120000 });
    result.status = response?.status() ?? null;
    if (!opts['show-demo']) await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
    await page.evaluate(() => document.fonts.ready.then(() => true));
    result.stuckLoading = await waitLoaded(page);
    result.loadMs = Date.now() - t0;
    await page.waitForTimeout(250);

    const m = await page.evaluate(inPageMeasure, minTapFor(device));
    Object.assign(result, {
      title: m.title,
      rawKeys: m.rawKeys,
      overflow: m.overflow,
      smallTargets: m.smallTargets,
      smallTargetsTotal: m.smallTargetsTotal,
      dataF: m.dataF,
    });
    if (combo.lang === 'hy') result.armenianFont = await checkArmenianFont(page, m.armenianMarked);

    await shot('');
    if (opts.full) await shot('full', true);

    if (steps?.length) {
      result.scenario = [];
      for (let i = 0; i < steps.length; i++) {
        const t = Date.now();
        try {
          const file = await runStep(page, steps[i], combo, (name) => shot(name));
          result.scenario.push({ i: i + 1, step: steps[i], ok: true, ms: Date.now() - t, screenshot: file });
        } catch (e) {
          const file = await shot(`fail-${i + 1}`).catch(() => undefined);
          result.scenario.push({ i: i + 1, step: steps[i], ok: false, ms: Date.now() - t, error: String(e.message).split('\n')[0], screenshot: file });
          break;
        }
      }
      // Что появилось на экране после сценария
      const after = await page.evaluate(inPageMeasure, minTapFor(device));
      result.dataF = [...new Set([...result.dataF, ...after.dataF])].sort();
    }
  } catch (e) {
    result.pageErrors.push(`замер не удался: ${String(e.message).split('\n')[0]}`);
    await shot('error').catch(() => {});
  } finally {
    await context.close();
  }
  return result;
}

// ─────────────────────────── Запуск ───────────────────────────
async function main() {
  let scenarios = [];
  if (opts.scenario) {
    const file = path.resolve(process.cwd(), String(opts.scenario));
    if (!fs.existsSync(file)) fail(`нет файла сценария ${file}`);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    scenarios = Array.isArray(parsed) ? parsed : [parsed];
  }

  let routes = list(opts.routes, []);
  const area = typeof opts.area === 'string' ? opts.area : undefined;
  if (area) routes = [...new Set([...(await fetchAreaRoutes(area)), ...routes])];
  if (!routes.length && !scenarios.length) fail('укажите --area, --routes или --scenario (см. --help)');

  const personas = list(opts.persona, ['owner']);
  const spheres = list(opts.sphere, ['nails']);
  const langs = list(opts.lang, ['ru']);
  const themes = list(opts.theme, ['light']);
  const devices = list(opts.device, ['phone', 'desktop']);

  const jobs = [];
  for (const route of routes)
    for (const persona of personas)
      for (const sphere of spheres)
        for (const lang of langs)
          for (const theme of themes)
            for (const device of devices) jobs.push({ route, combo: { persona, sphere, lang, theme, device } });
  for (const sc of scenarios) {
    const devs = sc.device ? [sc.device] : devices;
    for (const device of devs)
      jobs.push({
        route: sc.route ?? '/',
        steps: sc.steps ?? [],
        combo: {
          persona: sc.persona ?? personas[0],
          sphere: sc.sphere ?? spheres[0],
          lang: sc.lang ?? langs[0],
          theme: sc.theme ?? themes[0],
          device,
        },
      });
  }

  const outDir = path.resolve(ROOT, typeof opts.out === 'string' ? opts.out : path.join('qa/shots', area ?? (scenarios.length ? 'scenarios' : 'custom')));
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.resolve(ROOT, typeof opts.json === 'string' ? opts.json : path.join(outDir, 'report.json'));

  // Сервер жив?
  try {
    await fetch(`${BASE}/dev/health`);
  } catch {
    fail(`сервер ${BASE} не отвечает — запустите: bash scripts/ensure-dev.sh`);
  }

  let browser;
  try {
    browser = await (await acquireBrowserSlot(), chromium).launch({ headless: true });
  } catch (e) {
    fail(`не запустился Chromium: ${e.message.split('\n')[0]} (npx playwright install chromium)`);
  }

  console.log(`Замер: ${jobs.length} стр. → ${path.relative(ROOT, outDir)}/ (по ${CONCURRENCY} одновременно)`);
  const results = new Array(jobs.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await measure(browser, jobs[i], outDir);
      done++;
      process.stdout.write(`\r  ${done}/${jobs.length}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  process.stdout.write('\n');
  await browser.close();

  // Сводка
  const summary = {
    pages: results.length,
    consoleErrors: sum(results, (r) => r.console.errors.length + r.pageErrors.length),
    consoleWarnings: sum(results, (r) => r.console.warnings.length),
    badResponses: sum(results, (r) => r.badResponses.length),
    i18nMissing: sum(results, (r) => r.i18n.missing.length),
    i18nNoEn: sum(results, (r) => r.i18n.noEn.length),
    i18nFallbackRu: sum(results, (r) => r.i18n.fallbackRu),
    rawKeys: sum(results, (r) => r.rawKeys.length),
    overflowPages: results.filter((r) => r.overflow?.pageOverflow).length,
    smallTargets: sum(results, (r) => r.smallTargetsTotal),
    stuckLoading: results.filter((r) => r.stuckLoading).length,
    armenianFont: {
      checked: results.filter((r) => r.armenianFont?.checked).length,
      ok: results.filter((r) => r.armenianFont?.ok).length,
      fail: results.filter((r) => r.lang === 'hy' && !r.armenianFont?.ok).length,
    },
    dataF: [...new Set(results.flatMap((r) => r.dataF))].sort(),
    scenarioSteps: {
      ok: sum(results, (r) => r.scenario?.filter((s) => s.ok).length ?? 0),
      fail: sum(results, (r) => r.scenario?.filter((s) => !s.ok).length ?? 0),
    },
  };
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify({ base: BASE, measuredAt: new Date().toISOString(), summary, results }, null, 2));

  printTable(results);
  console.log(
    `\nИтог: страниц ${summary.pages} · ошибок консоли ${summary.consoleErrors} · предупреждений ${summary.consoleWarnings} · 4xx/5xx ${summary.badResponses}` +
      ` · i18n нет ключа ${summary.i18nMissing} / нет en ${summary.i18nNoEn} / hy→ru ${summary.i18nFallbackRu}` +
      ` · сырых ключей ${summary.rawKeys} · вылет ${summary.overflowPages} стр. · мелких целей ${summary.smallTargets}` +
      ` · висит загрузка ${summary.stuckLoading}` +
      (summary.armenianFont.checked || summary.armenianFont.fail ? ` · армянский шрифт ok ${summary.armenianFont.ok}/${summary.armenianFont.ok + summary.armenianFont.fail}` : '') +
      ` · data-f ${summary.dataF.length}` +
      (summary.scenarioSteps.ok + summary.scenarioSteps.fail ? ` · шагов сценария ok ${summary.scenarioSteps.ok}, упало ${summary.scenarioSteps.fail}` : ''),
  );
  console.log(`Отчёт: ${path.relative(ROOT, jsonPath)}`);
  const problems = results.filter((r) => r.console.errors.length || r.pageErrors.length || r.badResponses.length);
  for (const r of problems.slice(0, 8)) {
    console.log(`\n• ${r.route} [${r.persona}/${r.lang}/${r.device}]`);
    [...r.pageErrors, ...r.console.errors].slice(0, 3).forEach((e) => console.log(`   ${e.split('\n')[0].slice(0, 200)}`));
    r.badResponses.slice(0, 3).forEach((b) => console.log(`   ${b.status} ${b.url}`));
  }
}

function sum(items, fn) {
  return items.reduce((s, x) => s + fn(x), 0);
}

function printTable(results) {
  const head = ['страница', 'кто', 'яз', 'уст', 'конс', '4xx', 'ключи', 'вылет', '<цели', 'data-f', 'hy-шрифт', 'загр'];
  const rows = results.map((r) => [
    r.route.length > 30 ? `${r.route.slice(0, 29)}…` : r.route,
    r.persona,
    r.lang,
    { phone: 'тел', 'phone-sm': 'т360', 'phone-se': 'т375', desktop: 'деск' }[r.device] ?? r.device,
    String(r.console.errors.length + r.pageErrors.length) + (r.console.warnings.length ? `/${r.console.warnings.length}w` : ''),
    String(r.badResponses.length),
    String(r.rawKeys.length + r.i18n.missing.length),
    r.overflow?.pageOverflow ? `✗${r.overflow.scrollWidth - r.overflow.innerWidth}px` : '—',
    String(r.smallTargetsTotal),
    String(r.dataF.length),
    r.lang !== 'hy' ? '·' : r.armenianFont?.ok ? 'ok' : `✗ ${r.armenianFont?.reason ?? r.armenianFont?.fonts?.join(', ') ?? ''}`.slice(0, 40),
    r.stuckLoading ? 'висит' : `${(r.loadMs / 1000).toFixed(1)}с`,
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  console.log(line(head));
  console.log(widths.map((w) => '─'.repeat(w)).join('  '));
  rows.forEach((row) => console.log(line(row)));
}

main().catch((e) => fail(e.stack || e.message));
