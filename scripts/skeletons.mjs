// Замер скелетонов первой загрузки: совпадает ли каждый скелетон по размеру с содержимым, которое его сменяет,
// и сдвигается ли страница, когда приезжают данные (DESIGN.md → «Skeleton per element», владелец 30.09.2026:
// «скелетоны изначально сразу идеально на каждом элементе до загрузки»). Дев-сервер: bash scripts/ensure-dev.sh
//
//   node scripts/skeletons.mjs                          все маршруты /dev/routes, телефон и десктоп
//   node scripts/skeletons.mjs --area clients,journal   только разделы
//   node scripts/skeletons.mjs --routes /biz/clients --device phone --shots
//
// Страница открывается с ?api=slow (каждый запрос 1,5–2,5 с — скелетоны точно видны). Что меряется:
//   cls     сумма всех layout-shift за загрузку (ввода нет, считается всё). Цель — 0.
//   blocks  скелетон → содержимое: высота узла, в котором скелетон сменился содержимым (блок, ячейка, строка текста),
//           до замены (прошлый кадр) и после (через 2 кадра). dh — разница, px; dhVis — разница видимой на первом
//           экране части. Больше 4 px — «мимо» (список, продолжившийся ниже края экрана, не считается).
//   короб   «коробки» первого экрана (фон, рамка, тень, картинка) после загрузки, которых не было на том же месте
//           (±4 px по x, y, ширине, высоте) в фазе скелетонов: карточка другой высоты, строка съехала, плашка
//           появилась из пустоты. Список — moved в отчёте (hint = элемент и data-f). Цель — 0. Не считаются:
//           плавающее (position: fixed) и новая мелочь до 32 px (значок, которого в скелетоне не было) внутри
//           строки/карточки, оставшейся на месте (inner). Съехавшая мелочь (галочка на 12 px левее) — считается.
//   сдвиг   источники layout-shift: что сдвинулось без скелетона (появилось из пустоты, сменило ширину колонки).
// Чисто (✓) = cls < 0.01, коробки 0, блоки 0.
//
// Параметры: --area a,b  --routes /a,/b  --device phone|desktop|phone,desktop  --persona <id> (иначе по маршруту)
//   --lang ru  --api slow|fast (fast — обычные 40–120 мс)  --shots (кадр со скелетонами и итоговый)
//   --label run (отчёт qa/skeletons/<label>.json)  --concurrency 3  --base http://localhost:3710  --top 15
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from './pw-slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
if (opts.help) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\nimport ')[0].replace(/^\/\/ ?/gm, ''));
  process.exit(0);
}

const list = (v, def) => (v === undefined || v === true ? def : String(v).split(',').map((s) => s.trim()).filter(Boolean));
const BASE = String(opts.base ?? 'http://localhost:3710').replace(/\/$/, '');
const DEVICES = {
  // Как настоящий телефон: мобильный браузер — сервер по нему рисует первый кадр в раскладке телефона
  phone: {
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};
const CONCURRENCY = Math.max(1, Number(opts.concurrency ?? 3));
const LABEL = typeof opts.label === 'string' ? opts.label : 'run';
const OUT = path.join(ROOT, 'qa/skeletons');
const TOL = 4;

function personaFor(route) {
  if (typeof opts.persona === 'string') return opts.persona;
  if (route.startsWith('/platform')) return 'platform';
  if (route.startsWith('/biz/network') || route.endsWith('/network')) return 'network';
  if (route.startsWith('/biz') || route.startsWith('/dev')) return 'owner';
  return 'client';
}

function buildUrl(route, persona) {
  const params = new URLSearchParams({ demo: persona, empty: '0', sphere: 'nails', lang: opts.lang ?? 'ru', theme: 'light' });
  if (opts.api !== 'fast') params.set('api', 'slow');
  return `${BASE}${route}${route.includes('?') ? '&' : '?'}${params}`;
}

// ─────────────── В странице: запускается до кода приложения (addInitScript) ───────────────
function initProbe() {
  const hint = (el) => {
    if (!el || el.nodeType !== 1) return el?.nodeType === 3 ? '#text' : '?';
    const f = el.closest('[data-f]');
    const tag = el.tagName.toLowerCase();
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter((c) => c && !c.includes(':')).slice(0, 3).join('.') : '';
    const f0 = f ? ` in [data-f=${f.getAttribute('data-f').split(/\s+/)[0]}]` : '';
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `${tag}${cls ? `.${cls}` : ''}${f0}${txt ? ` «${txt}»` : ''}`;
  };
  const rectOf = (r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
  const S = (window.__sk = { shifts: [], blocks: [], maxSkeletons: 0, firstSkeletonAt: null });
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        S.shifts.push({
          t: Math.round(e.startTime),
          v: e.value,
          src: (e.sources || []).slice(0, 4).map((s) => ({ el: hint(s.node), prev: rectOf(s.previousRect), cur: rectOf(s.currentRect) })),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}

  // «Коробки» первого экрана: всё, что видно как форма, — фон, рамка, тень, картинка (скелетоны тоже). Снимок в фазе
  // скелетонов и после загрузки: у идеального скелетона каждая коробка итоговой страницы стоит там же, где стояла коробка.
  S.snapBoxes = () => {
    const out = [];
    const index = new Map();
    const vw = innerWidth, vh = innerHeight;
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('[data-demo-fab]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 12 || r.height < 12 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
      if (r.width > vw * 0.95 && r.height > vh * 0.9) continue; // обёртки страницы
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'contents') continue;
      const bg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
      const border = ['Top', 'Right', 'Bottom', 'Left'].some((d) => parseFloat(cs[`border${d}Width`]) > 0 && !/rgba\(.*, 0\)$/.test(cs[`border${d}Color`]));
      const media = el.tagName === 'IMG';
      if (!bg && !border && !media && cs.boxShadow === 'none') continue;
      // Значок-счётчик поверх иконки (колокольчик «4»): вне потока и мелкий — ничего не сдвигает, может проявиться позже
      if ((cs.position === 'absolute' || cs.position === 'fixed') && r.width <= 24 && r.height <= 24) continue;
      // Ближайшая коробка-предок (строка, карточка): мелочь внутри неизменившейся строки — не прыжок
      let parent = -1;
      for (let p = el.parentElement; p && parent < 0; p = p.parentElement) parent = index.get(p) ?? -1;
      index.set(el, out.length);
      out.push({
        x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
        // Внутри плавающего (fixed: нижняя панель с кнопками) — тоже плавающее
        sk: Boolean(el.closest('[data-skeleton]')), fixed: cs.position === 'fixed' || (parent >= 0 && out[parent].fixed), parent, hint: hint(el),
      });
    }
    return out;
  };

  // Каждый кадр — размеры скелетонов и их предков (до 15 уровней): при замене сравниваем высоту узла, в котором
  // она произошла, до (прошлый кадр) и после (через 2 кадра). Так видно и блок, и текст, сменивший полосу в строке.
  let anc = new Map();
  const isSk = (el) => el.nodeType === 1 && el.matches('[data-skeleton]') && !el.closest('[data-showcase]');
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const tick = () => {
    const next = new Map();
    let n = 0;
    for (const el of document.querySelectorAll('[data-skeleton]')) {
      if (el.closest('[data-showcase]') || el.parentElement?.closest('[data-skeleton]')) continue;
      n++;
      if (!el.getClientRects().length) continue;
      let p = el;
      for (let i = 0; i < 16 && p && p !== document.body; i++, p = p.parentElement) if (!next.has(p)) next.set(p, box(p));
    }
    anc = next;
    if (n && S.firstSkeletonAt === null) S.firstSkeletonAt = Math.round(performance.now());
    // Фаза скелетонов: страница успокоилась (конечные анимации появления закончились — бесконечное мерцание
    // скелетонов не в счёт), но ни один скелетон ещё не сменился данными. Не успокоилась за 1,2 с — снимаем как есть.
    if (n && !S.boxes0) {
      const since = performance.now() - S.firstSkeletonAt;
      const moving = document.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity);
      if ((since > 300 && !moving) || since > 1200 || S.blocks.length > 0) {
        S.boxes0 = { at: Math.round(performance.now()), early: S.blocks.length > 0, moving, boxes: S.snapBoxes() };
      }
    }
    S.maxSkeletons = Math.max(S.maxSkeletons, n);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const start = () => {
    new MutationObserver((records) => {
      const groups = new Map();
      for (const rec of records) {
        if (rec.type !== 'childList') continue;
        for (const node of rec.removedNodes) {
          if (node.nodeType !== 1) continue;
          const sks = [...(isSk(node) ? [node] : []), ...node.querySelectorAll('[data-skeleton]')].filter((el) => anc.has(el));
          if (!sks.length) continue;
          const g = groups.get(rec.target) || { sk: [], added: [] };
          g.sk.push(...sks.map((el) => anc.get(el)));
          groups.set(rec.target, g);
        }
      }
      if (!groups.size) return;
      for (const rec of records) {
        const g = groups.get(rec.target);
        if (g && rec.type === 'childList') for (const node of rec.addedNodes) if (!(node.nodeType === 1 && isSk(node))) g.added.push(node);
      }
      for (const [target, g] of groups) {
        const before = anc.get(target);
        if (!before) continue;
        const firstEl = g.added.find((x) => x.nodeType === 1);
        const block = {
          where: hint(target),
          what: firstEl ? hint(firstEl) : g.added.length ? '#text' : '—',
          sk: g.sk.reduce((a, r) => ({ h: a.h + r.h, w: Math.max(a.w, r.w) }), { h: 0, w: 0 }),
          before,
          after: null,
          t: Math.round(performance.now()),
        };
        S.blocks.push(block);
        requestAnimationFrame(() => requestAnimationFrame(() => { if (target.isConnected) block.after = box(target); }));
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.documentElement) start();
  else document.addEventListener('readystatechange', start, { once: true });

  S.finish = () => {
    S.boxes1 = S.snapBoxes();
    const { finish, snapBoxes, ...rest } = S;
    return JSON.parse(JSON.stringify(rest));
  };
}

function loadingDone() {
  const vis = (el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  return ![...document.querySelectorAll('[data-skeleton], [aria-busy="true"]')].some((el) => !el.closest('[data-showcase]') && vis(el));
}

async function measure(browser, job) {
  const { route, device, persona } = job;
  const context = await browser.newContext({ ...DEVICES[device], locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  await context.addInitScript(initProbe);
  await context.addInitScript(() => {
    // Демо-кнопку прячем сразу — она не часть страницы
    const css = '[data-demo-fab]{display:none!important}';
    const add = () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add, { once: true });
  });
  const page = await context.newPage();
  const r = { route, device, persona, url: buildUrl(route, persona), cls: 0, blocks: [], shifts: [], moved: [], gone: [], maxSkeletons: 0, stuck: false, error: null, shots: [] };
  try {
    await page.goto(r.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (opts.shots) {
      try { await page.waitForSelector('[data-skeleton]', { timeout: 3000 }); await page.waitForTimeout(200); } catch {}
      const f = path.join(OUT, 'shots', LABEL, `${slug(route)}__${device}__1-skeleton.png`);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      await page.screenshot({ path: f });
      r.shots.push(path.relative(ROOT, f));
    }
    try { await page.waitForFunction(loadingDone, null, { timeout: 20000, polling: 100 }); } catch { r.stuck = true; }
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
    const s = await page.evaluate(() => window.__sk.finish());
    r.maxSkeletons = s.maxSkeletons;
        r.shifts = s.shifts.filter((x) => x.v >= 0.001).sort((a, b) => b.v - a.v).slice(0, 8);
    r.cls = Number(s.shifts.reduce((a, x) => a + x.v, 0).toFixed(4));
    // Ниже первого экрана пользователь при загрузке ничего не видит: рост блока за краем экрана — не «мимо»
    const vh = DEVICES[device].viewport.height;
    const visH = (x) => Math.max(0, Math.min(x.y + x.h, vh) - Math.max(x.y, 0));
    // Коробки итоговой страницы без пары в фазе скелетонов (±TOL px по x, y, ширине, высоте)
    if (s.boxes0) {
      const near = (a, b) => Math.abs(a.x - b.x) <= TOL && Math.abs(a.y - b.y) <= TOL && Math.abs(a.w - b.w) <= TOL && Math.abs(a.h - b.h) <= TOL;
      const matched = s.boxes1.map((b) => s.boxes0.boxes.some((a) => near(a, b)));
      // Не прыжок: плавающее (fixed: кнопка «+», тосты) и мелочь до 32 px внутри строки/карточки, которая сама
      // осталась на месте (значок «3 неявки», аватар в строке той же высоты)
      // Прощается только НОВАЯ деталь: такая же по размеру коробка рядом (до 48 px) была — значит, она съехала, это сдвиг
      const displaced = (b) => s.boxes0.boxes.some((a) => Math.abs(a.w - b.w) <= TOL && Math.abs(a.h - b.h) <= TOL && Math.abs(a.x - b.x) <= 48 && Math.abs(a.y - b.y) <= 48);
      const excused = (b) => b.fixed || (b.h <= 32 && b.parent >= 0 && matched[b.parent] && !displaced(b));
      r.moved = s.boxes1.filter((b, i) => !matched[i] && !excused(b));
      r.inner = s.boxes1.filter((b, i) => !matched[i] && excused(b)).length;
      r.gone = s.boxes0.boxes.filter((a) => !a.sk && !s.boxes1.some((b) => near(a, b)));
      r.boxesEarly = s.boxes0.early;
      if (opts.debug) r.boxes0 = s.boxes0;
    } else r.noSkeleton = true;
    r.blocks = s.blocks.map((b) => {
      const dh = b.after ? b.after.h - b.before.h : null;
      const dhVis = b.after ? visH({ y: b.before.y, h: b.after.h }) - visH(b.before) : null;
      return { ...b, dh, dhVis, bad: dhVis !== null && Math.abs(dhVis) > TOL };
    });
    if (opts.shots) {
      const f = path.join(OUT, 'shots', LABEL, `${slug(route)}__${device}__2-final.png`);
      await page.screenshot({ path: f });
      r.shots.push(path.relative(ROOT, f));
    }
  } catch (e) {
    r.error = String(e.message || e).split('\n')[0];
  } finally {
    await context.close();
  }
  return r;
}

function slug(route) {
  const clean = route.split('?')[0].replace(/^\/+|\/+$/g, '');
  return clean ? clean.replace(/[^a-zA-Z0-9]+/g, '-') : 'home';
}

async function main() {
  let routes = list(opts.routes, []);
  const areas = list(opts.area, []);
  if (!routes.length || areas.length) {
    const res = await fetch(`${BASE}/dev/routes`).catch(() => null);
    if (!res?.ok) { console.error(`✗ сервер ${BASE} не отвечает — bash scripts/ensure-dev.sh`); process.exit(1); }
    const data = await res.json();
    const pick = areas.length ? areas : Object.keys(data.areas);
    for (const a of pick) {
      if (!data.areas[a]) { console.error(`✗ нет раздела ${a}`); process.exit(1); }
      routes.push(...data.areas[a]);
    }
    routes = [...new Set(routes)];
  }
  const devices = list(opts.device, ['phone', 'desktop']);
  const jobs = routes.flatMap((route) => devices.map((device) => ({ route, device, persona: personaFor(route) })));

  const release = await acquireBrowserSlot();
  const browser = await chromium.launch({ headless: true });
  console.log(`Скелетоны: ${jobs.length} стр. (${opts.api === 'fast' ? 'обычная сеть' : 'api=slow'}), по ${CONCURRENCY}`);
  const results = new Array(jobs.length);
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await measure(browser, jobs[i]);
      process.stdout.write(`\r  ${++done}/${jobs.length}`);
    }
  }));
  await browser.close();
  release();
  process.stdout.write('\n');

  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${LABEL}.json`);
  fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), api: opts.api === 'fast' ? 'fast' : 'slow', results }, null, 1));

  const pad = (s, n) => String(s).padEnd(n);
  const isClean = (r) => !r.error && !r.stuck && r.cls < 0.01 && !r.moved.length && !r.blocks.some((b) => b.bad);
  const score = (r) => r.cls * 100 + r.moved.length + r.blocks.filter((b) => b.bad).length;
  console.log(`\n${pad('страница', 40)} ${pad('уст', 5)} ${pad('cls', 7)} ${pad('короб', 6)} ${pad('блок', 5)} что не совпало`);
  for (const r of results.slice().sort((a, b) => score(b) - score(a))) {
    const bad = r.blocks.filter((b) => b.bad);
    const worst = bad.slice().sort((a, b) => Math.abs(b.dhVis ?? 999) - Math.abs(a.dhVis ?? 999))[0];
    const w = r.error
      ? `ошибка: ${r.error}`
      : r.stuck
        ? 'висит загрузка'
        : r.moved[0]
          ? `${r.moved[0].hint}`
          : worst
            ? `${worst.dhVis > 0 ? '+' : ''}${worst.dhVis}px ${worst.where}`
            : r.shifts[0]
              ? `сдвиг: ${r.shifts[0].src[0]?.el ?? '?'}`
              : r.noSkeleton
                ? '(скелетонов не было)'
                : '';
    const mark = isClean(r) ? '✓ ' : '';
    console.log(`${pad(r.route.slice(0, 40), 40)} ${pad(r.device === 'phone' ? 'тел' : 'деск', 5)} ${pad(r.cls ? r.cls.toFixed(3) : '0', 7)} ${pad(r.moved.length, 6)} ${pad(bad.length, 5)} ${mark}${w.slice(0, 90)}`);
  }
  const sum = (f) => results.reduce((a, r) => a + f(r), 0);
  console.log(`\nИтог: страниц ${results.length} · чисто ${results.filter(isClean).length} · cls>0.01 ${results.filter((r) => r.cls >= 0.01).length} · коробок не на месте ${sum((r) => r.moved.length)} · блоков мимо ${sum((r) => r.blocks.filter((b) => b.bad).length)} · ошибок ${results.filter((r) => r.error).length} · висит ${results.filter((r) => r.stuck).length}`);
  console.log(`Отчёт: ${path.relative(ROOT, file)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
