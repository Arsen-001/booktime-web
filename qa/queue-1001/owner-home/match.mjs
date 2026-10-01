// Сверка главной с отчётами в одном браузере (мок): node match.mjs
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const go = async (p) => { await page.goto('http://localhost:3710' + p, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2500); return (await page.innerText('main')).replace(/\s+/g, ' '); };
  const home = await go('/biz?demo=owner&empty=0&lang=ru&data=mock');
  const pick = (re, s) => (s.match(re) ?? [])[1];
  const h = { revenue: pick(/Выручка за [^ ]+ \d+ ([\d  ]+֏)/, home), load: pick(/Загрузка по графику (\d+%)/, home), loadSub: pick(/(\d[\d ,]* из [\d ,]+ ч)/, home), rebook: pick(/Записались снова (\d+%)/, home), noShow: pick(/Не пришли (\d+)/, home), due: pick(/Пора позвать (\d+)/, home) };
  const dash = await go('/biz/reports?from=2026-09-02&to=2026-10-01');
  const d = { rebook: pick(/Доля перезаписи[^%]*?(\d+%)/, dash), noShow: pick(/Клиент не пришел (\d+)|Не пришел (\d+)/, dash), dashSnippet: dash.slice(dash.indexOf('Заполненность'), dash.indexOf('Заполненность') + 260) };
  const month = await go('/biz/reports?from=2026-10-01&to=2026-10-01');
  const m = { total: month.slice(month.indexOf('Итого'), month.indexOf('Итого') + 40) };
  const load = await go('/biz/reports/r/workload?from=2026-09-02&to=2026-10-01');
  const l = { total: pick(/(Всего[^.]*?ч[^ ]*)/, load) ?? load.slice(0, 300) };
  const clients = await go('/biz/clients?pick=due');
  const c = { found: pick(/(Найдено[^А-Я]*\d+[^ ]* ?\S*)/, clients) ?? clients.slice(0, 200) };
  console.log(JSON.stringify({ home: h, dashboard: d, monthDashboard: m, workload: l, clientsDue: c }, null, 1));
} finally { await browser.close(); release(); }
