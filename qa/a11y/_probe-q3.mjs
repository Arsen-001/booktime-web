// Замер слабых телефонов + доступности для booking-platform.
// Запуск: node a11y-probe.mjs --out <dir>
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3710';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : '/private/tmp/a11y-out';
fs.mkdirSync(OUT, { recursive: true });

const AREAS = {
  client: ['/', '/search', '/bookings', '/favorites', '/profile', '/biz/apps', '/biz/apps/stories', '/biz/apps/news', '/biz/apps/promotion', '/biz/apps/reminders', '/biz/apps/branded', '/biz/apps/translations'],
  journal: ['/biz/journal', '/biz/journal/settings', '/biz/records'],
  schedule: ['/biz/schedule', '/biz/schedule/calendar', '/biz/schedule/templates', '/biz/schedule/slots', '/biz/schedule/series', '/biz/schedule/history'],
  resources: ['/biz/groups', '/biz/waitlist', '/biz/resources'],
  clients: ['/biz/clients', '/biz/clients/summary', '/biz/clients/categories', '/biz/clients/loyalty', '/biz/clients/import', '/biz/clients/log', '/biz/clients/cl_001'],
  online: ['/biz/online', '/biz/online/page', '/biz/online/widget', '/biz/online/settings', '/biz/online/requests', '/biz/online/places', '/b/nuri-nail-studio'],
  notify: ['/biz/notifications', '/biz/notifications/channels', '/biz/notifications/mailings', '/biz/notifications/log', '/biz/notifications/inbox'],
  loyalty: ['/biz/loyalty', '/biz/loyalty/promotions', '/biz/loyalty/certificates', '/biz/loyalty/memberships', '/biz/loyalty/deposits', '/biz/loyalty/referral'],
  finance: ['/biz/finance', '/biz/finance/accounts', '/biz/finance/items', '/biz/finance/counterparties', '/biz/finance/documents', '/biz/finance/methods', '/biz/finance/settlements'],
  payroll: ['/biz/payroll', '/biz/payroll/daily', '/biz/payroll/period', '/biz/payroll/bonuses'],
  reports: ['/biz/reports', '/biz/reports/all'],
  services: ['/biz/services', '/biz/services/sv_nuri_classic'],
  staff: ['/biz/staff', '/biz/staff/positions', '/biz/staff/roles', '/biz/staff/log', '/biz/staff/st_nuri_ani'],
  stock: ['/biz/stock', '/biz/stock/warehouses', '/biz/stock/tech-cards', '/biz/stock/operations', '/biz/stock/inventory', '/biz/stock/equipment'],
  network: ['/biz/network'],
  settings: ['/biz/settings', '/biz/onboarding', '/biz/billing', '/biz/coins'],
  integrations: ['/biz/integrations', '/biz/integrations/api'],
  platform: ['/platform', '/platform/businesses', '/platform/plan', '/platform/moderation', '/platform/connect', '/platform/visits', '/platform/promocodes', '/platform/ads', '/platform/demand', '/platform/sphere-requests', '/platform/ideas', '/platform/support'],
};

const PERSONA_FOR = (route) => {
  if (route.startsWith('/platform')) return 'platform';
  if (['/', '/search', '/bookings', '/favorites', '/profile'].includes(route)) return 'client';
  return 'owner';
};

function buildUrl(route, { lang, font, extra }) {
  const params = new URLSearchParams({ demo: PERSONA_FOR(route), sphere: 'nails', lang, theme: 'dark' });
  if (font) params.set('font', font);
  return `${BASE}${route}${route.includes('?') ? '&' : '?'}${params.toString()}${extra ? '&' + extra : ''}`;
}

const INIT_SCRIPT = `
window.__probe = { longTasks: [], longTasksTotal: 0, cls: 0, clsEntries: [] };
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      window.__probe.longTasks.push(e.duration);
      window.__probe.longTasksTotal += e.duration;
    }
  }).observe({ type: 'longtask', buffered: true });
} catch {}
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (!e.hadRecentInput) { window.__probe.cls += e.value; window.__probe.clsEntries.push(e.value); }
    }
  }).observe({ type: 'layout-shift', buffered: true });
} catch {}
`;

function luminance([r, g, b]) {
  const c = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrastRatio(fg, bg) {
  const l1 = luminance(fg) + 0.05;
  const l2 = luminance(bg) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

function inPageAudit() {
  const parseColor = (str) => {
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] === undefined ? 1 : parts[3] };
  };
  const visible = (el) => {
    if (!el || !el.getClientRects().length) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const hint = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const df = el.closest('[data-f]')?.getAttribute('data-f');
    const txt = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${id}${cls === '.' ? '' : cls}${df ? ` [${df}]` : ''} "${txt}"`;
  };

  // 1. Горизонтальный вылет
  const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
  const overflowDelta = document.documentElement.scrollWidth - document.documentElement.clientWidth;

  // 2. Зоны нажатия < 44px
  const smallTargets = [];
  document.querySelectorAll('button, a[href], [role="button"], input, select, textarea, [tabindex]:not([tabindex="-1"])').forEach((el) => {
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    if ((r.width > 0 && r.width < 44) || (r.height > 0 && r.height < 44)) {
      if (r.width < 4 || r.height < 4) return; // невидимые/технические
      smallTargets.push({ where: hint(el), w: Math.round(r.width), h: Math.round(r.height) });
    }
  });

  // 3. Обрезанный текст (ellipsis реально режет содержимое)
  const truncated = [];
  document.querySelectorAll('*').forEach((el) => {
    if (truncated.length >= 20) return;
    if (!el.children.length && visible(el)) {
      const s = getComputedStyle(el);
      if (s.textOverflow === 'ellipsis' && s.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 2) {
        truncated.push({ where: hint(el), text: (el.textContent || '').trim().slice(0, 60) });
      }
    }
  });

  // 4. Иконочные кнопки без aria-label
  const unlabeledIconButtons = [];
  document.querySelectorAll('button, [role="button"], a[href]').forEach((el) => {
    if (!visible(el)) return;
    const text = (el.textContent || '').trim();
    const hasAccessibleName = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title');
    const hasSvg = el.querySelector('svg');
    if (!text && hasSvg && !hasAccessibleName) {
      unlabeledIconButtons.push({ where: hint(el) });
    }
  });

  // 5. Порядок заголовков
  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(visible).map((h) => ({
    level: Number(h.tagName[1]),
    text: (h.textContent || '').trim().slice(0, 50),
  }));
  const headingIssues = [];
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length === 0) headingIssues.push('нет h1 на странице');
  if (h1s.length > 1) headingIssues.push(`h1 встречается ${h1s.length} раз`);
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level - headings[i - 1].level > 1) {
      headingIssues.push(`прыжок h${headings[i - 1].level} → h${headings[i].level} у «${headings[i].text}»`);
    }
  }

  // 6. Контраст текста (выборочно — узлы с прямым текстом)
  const contrastIssues = [];
  const bgOf = (el) => {
    let cur = el;
    while (cur && cur !== document.documentElement) {
      const c = getComputedStyle(cur).backgroundColor;
      const p = parseColor(c);
      if (p && p.a > 0.5) return [p.r, p.g, p.b];
      cur = cur.parentElement;
    }
    return [27, 25, 48]; // fallback --bg тёмной темы примерно
  };
  let checked = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node && checked < 400; node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (text.length < 2) continue;
    const parent = node.parentElement;
    if (!parent || !visible(parent)) continue;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG'].includes(parent.tagName)) continue;
    checked++;
    const s = getComputedStyle(parent);
    const fg = parseColor(s.color);
    if (!fg) continue;
    const bg = bgOf(parent);
    const ratio = (() => {
      const l1 = ((c) => {
        const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
        return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
      })([fg.r, fg.g, fg.b]) + 0.05;
      const l2 = ((c) => {
        const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
        return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
      })(bg) + 0.05;
      return l1 > l2 ? l1 / l2 : l2 / l1;
    })();
    const fontSize = parseFloat(s.fontSize);
    const bold = Number(s.fontWeight) >= 600 || s.fontWeight === 'bold';
    const isLarge = fontSize >= 24 || (fontSize >= 18.66 && bold);
    const threshold = isLarge ? 3 : 4.5;
    if (fg.a < 0.5) continue; // почти прозрачный текст — не текст
    if (ratio < threshold && contrastIssues.length < 15) {
      contrastIssues.push({ where: hint(parent), text: text.slice(0, 40), ratio: Math.round(ratio * 100) / 100, needed: threshold, fontSize: Math.round(fontSize) });
    }
  }

  // 7. Армянский шрифт (hy): системный ли рисуется
  const armFontIssues = [];
  if (document.documentElement.lang === 'hy' || location.href.includes('lang=hy')) {
    document.querySelectorAll('*').forEach((el) => {
      if (armFontIssues.length >= 5) return;
      if (el.children.length || !visible(el)) return;
      const text = (el.textContent || '').trim();
      const arm = (text.match(/[Ա-֏]/g) || []).length;
      if (arm >= 3) {
        const ff = getComputedStyle(el).fontFamily;
        if (!/noto/i.test(ff)) armFontIssues.push({ where: hint(el), fontFamily: ff, text: text.slice(0, 30) });
      }
    });
  }

  return {
    overflowX, overflowDelta,
    smallTargets: smallTargets.slice(0, 25), smallTargetsCount: smallTargets.length,
    truncated,
    unlabeledIconButtons: unlabeledIconButtons.slice(0, 15), unlabeledIconButtonsCount: unlabeledIconButtons.length,
    headings, headingIssues,
    contrastIssues, contrastChecked: checked,
    armFontIssues,
    isPlaceholder: /раздел строится|скоро|coming soon/i.test(document.body.textContent || ''),
    bodyTextLen: (document.body.textContent || '').trim().length,
  };
}

async function measureFocusOrder(page) {
  // Табуляция первых N фокусируемых, проверка видимого фокуса
  await page.keyboard.press('Tab').catch(() => {});
  const results = [];
  for (let i = 0; i < 12; i++) {
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      const hasOutline = s.outlineStyle !== 'none' && s.outlineWidth !== '0px';
      const hasRing = s.boxShadow !== 'none';
      const tag = el.tagName.toLowerCase();
      const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 30);
      return { tag, label, visibleFocus: hasOutline || hasRing, inViewport: r.top >= 0 && r.top < (window.innerHeight || 844) };
    });
    if (!info) break;
    results.push(info);
    await page.keyboard.press('Tab').catch(() => {});
  }
  return results;
}

async function measureRoute(browser, area, route, cond) {
  const ctx2 = await browser.newContext({
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: cond.lang === 'hy' ? 'hy-AM' : 'ru-RU',
    colorScheme: 'dark',
  });
  const page = await ctx2.newPage();
  const session = await ctx2.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (400 * 1024) / 8, // ~400kbps — «медленная 3G/слабый LTE»
    uploadThroughput: (200 * 1024) / 8,
    latency: 300,
  });
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await page.addInitScript(INIT_SCRIPT);

  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200)); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + String(err).slice(0, 200)));

  let jsBytes = 0;
  let reqCount = 0;
  page.on('response', (res) => {
    try {
      const ct = res.headers()['content-type'] || '';
      if (ct.includes('javascript') || res.url().endsWith('.js')) {
        reqCount++;
        const len = Number(res.headers()['content-length'] || 0);
        if (len) jsBytes += len;
      }
    } catch {}
  });

  const url = buildUrl(route, cond);
  const t0 = Date.now();
  let navError = null;
  let fcp = null;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200); // дать долгим задачам и layout-shift накопиться
  } catch (e) {
    navError = String(e).slice(0, 300);
  }
  const loadMs = Date.now() - t0;

  let audit = null, probe = null, focusOrder = [];
  if (!navError) {
    try {
      fcp = await page.evaluate(() => {
        const p = performance.getEntriesByName('first-contentful-paint')[0];
        return p ? Math.round(p.startTime) : null;
      });
      probe = await page.evaluate(() => window.__probe);
      audit = await page.evaluate(inPageAudit);
      focusOrder = await measureFocusOrder(page);
    } catch (e) {
      navError = 'post-load eval: ' + String(e).slice(0, 200);
    }
  }

  await ctx2.close();

  return {
    area, route, lang: cond.lang, font: cond.font || 'normal',
    url, loadMs, fcp,
    longTasksCount: probe?.longTasks?.length ?? null,
    longTasksTotalMs: probe ? Math.round(probe.longTasksTotal) : null,
    cls: probe ? Math.round(probe.cls * 1000) / 1000 : null,
    jsBytes, reqCount,
    consoleErrors: consoleErrors.slice(0, 10),
    navError,
    focusOrder,
    ...audit,
  };
}

async function main() {
  let browser = await chromium.launch();
  const results = [];
  const passes = [
    { lang: 'ru', font: 'normal', label: 'weak-ru-dark' },
    { lang: 'hy', font: 'large', label: 'weak-hy-dark-largefont' },
  ];
  const doneFile = path.join(OUT, 'raw.json');
  const skipSet = new Set();
  if (fs.existsSync(doneFile)) {
    try {
      const prev = JSON.parse(fs.readFileSync(doneFile, 'utf8'));
      for (const r of prev) {
        if (!r.error && !r.navError) { results.push(r); skipSet.add(`${r.area}|${r.route}|${r.pass}`); }
      }
      console.log(`resume: ${results.length} уже готовы, пропускаю их`);
    } catch {}
  }
  for (const [area, routes] of Object.entries(AREAS)) {
    for (const route of routes) {
      for (const cond of passes) {
        const key = `${area}|${route}|${cond.label}`;
        if (skipSet.has(key)) continue;
        process.stdout.write(`${area} ${route} [${cond.label}]... `);
        let attempt = 0;
        while (attempt < 2) {
          attempt++;
          try {
            const r = await measureRoute(browser, area, route, cond);
            r.pass = cond.label;
            results.push(r);
            console.log(`ok fcp=${r.fcp} load=${r.loadMs} cls=${r.cls} js=${Math.round((r.jsBytes||0)/1024)}KB small=${r.smallTargetsCount} contrast=${(r.contrastIssues||[]).length}${r.navError ? ' NAVERROR' : ''}`);
            break;
          } catch (e) {
            const msg = String(e);
            console.log(`FAIL(попытка ${attempt}) ` + msg.slice(0, 150));
            if (/closed|crash|Target page/i.test(msg)) {
              try { await browser.close(); } catch {}
              browser = await chromium.launch();
            }
            if (attempt >= 2) {
              results.push({ area, route, pass: cond.label, error: msg.slice(0, 300) });
            }
          }
        }
        fs.writeFileSync(doneFile, JSON.stringify(results, null, 2));
      }
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'raw.json'), JSON.stringify(results, null, 2));
  console.log('\nDONE ->', path.join(OUT, 'raw.json'));
}

main();
