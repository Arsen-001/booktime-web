// Сверка цифр отчётов с сырыми данными журнала/склада/финансов (localStorage мок-базы).
// node qa/full-test-0930/reports/crosscheck.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/reports';
const Q = 'demo=owner&lang=ru&sphere=nails&theme=light';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = [];
const say = (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); console.log(s); log.push(s); };
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => say('PAGEERR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') say('CONSOLE', m.text().slice(0, 200)); });

  const open = async (path, wait = 3500) => {
    await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}${Q}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(wait);
    for (let i = 0; i < 20; i++) {
      const busy = await page.locator('[aria-busy="true"], .animate-pulse').count();
      if (!busy) break;
      await page.waitForTimeout(500);
    }
  };

  await open('/biz/reports');
  const ONLY = process.argv[2] ? process.argv[2].split(',') : null;
  const raw = await page.evaluate(() => {
    const get = (k) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } };
    const keys = Object.keys(localStorage);
    return { keys, bookings: get('bp-mock-db:core:bookings'), clients: get('bp-mock-db:core:clients'), staff: get('bp-mock-db:core:staff'), businesses: get('bp-mock-db:core:businesses'), stock: get('bp-mock-db:area:stock'), finance: get('bp-mock-db:area:finance'), period: sessionStorage.getItem('bt_reports_period') };
  });
  say('keys', raw.keys.filter((k) => k.startsWith('bp-mock-db')).length, 'bookings', Array.isArray(raw.bookings) ? raw.bookings.length : typeof raw.bookings);
  fs.writeFileSync(`${OUT}/dashboard.txt`, await page.innerText('main'));
  await page.screenshot({ path: `${OUT}/dashboard-desktop.png`, fullPage: true });

  const unwrap = (x) => (x && !Array.isArray(x) && typeof x === 'object' && ('state' in x) ? x.state : x);
  const bookings = unwrap(raw.bookings) ?? [];
  const clients = unwrap(raw.clients) ?? [];
  const stock = unwrap(raw.stock) ?? {};
  const finance = unwrap(raw.finance) ?? {};
  fs.writeFileSync(`${OUT}/raw-shape.json`, JSON.stringify({ b: Object.keys(raw.bookings ?? {}).slice(0, 5), s: Object.keys(stock).slice(0, 30), f: Object.keys(finance).slice(0, 30), businesses: (unwrap(raw.businesses) ?? []).map((b) => ({ id: b.id, kind: b.kind, name: b.name, sphere: b.sphere ?? b.spheres, loc: b.locationIds, net: b.networkId })) }, null, 1));

  const d = new Date();
  const iso = (x) => x.toISOString().slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  const local = (x) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  const to = local(d);
  const fromD = new Date(d); fromD.setDate(d.getDate() - 29);
  const from = local(fromD);
  say('range', from, to);
  const phoneOf = new Map(clients.map((c) => [c.id, c.phone]));
  const byBiz = {};
  for (const b of bookings) {
    const k = `${b.businessId}|${b.locationId}`;
    const r = (byBiz[k] ??= { services: 0, servicesCount: 0, visits: new Set(), appts: 0, clients: new Set(), completed: 0, noShow: 0, cancelled: 0, arrivedNoDeleted: 0 });
    const day = b.start.slice(0, 10);
    if (day < from || day > to) continue;
    r.appts += 1;
    if (b.status === 'arrived' && !b.deletedAt) {
      r.services += b.total; r.servicesCount += b.services.length; r.visits.add(b.visitId ?? b.id); r.completed += 1;
      if (b.clientId && phoneOf.get(b.clientId)) r.clients.add(b.clientId);
    }
    if (b.status === 'no_show' && !b.deletedAt) r.noShow += 1;
    if (b.deletedAt || b.status === 'cancelled_by_client' || b.status === 'cancelled_by_master') r.cancelled += 1;
  }
  const sales = (stock.operations ?? []).filter((o) => o.type === 'sale' && o.paid && !o.cancelledAt && o.date.slice(0, 10) >= from && o.date.slice(0, 10) <= to);
  const salesByLoc = {};
  for (const o of sales) {
    const r = (salesByLoc[o.locationId] ??= { amount: 0, qty: 0, n: 0 });
    for (const l of o.lines) { r.amount += Math.abs(l.qtySale) * l.unitPrice; r.qty += Math.abs(l.qtySale); }
    r.n += 1;
  }
  const finOps = (finance.operations ?? []).filter((o) => !o.cancelled && o.date.slice(0, 10) >= from && o.date.slice(0, 10) <= to);
  const finByLoc = {};
  for (const o of finOps) { const r = (finByLoc[o.locationId] ??= { income: 0, expense: 0 }); if (o.kind === 'income') r.income += o.amount; if (o.kind === 'expense') r.expense += o.amount; }
  const discounts = (finance.bookingPayments ?? []).filter((p) => p.kind === 'discount' && !p.cancelled);
  say('discount lines total', discounts.length, discounts.reduce((s, p) => s + p.amount, 0));
  const summary = Object.entries(byBiz).map(([k, r]) => ({ k, services: r.services, servicesCount: r.servicesCount, visits: r.visits.size, appts: r.appts, clients: r.clients.size, completed: r.completed, noShow: r.noShow, cancelled: r.cancelled, products: salesByLoc[k.split('|')[1]] ?? null, finance: finByLoc[k.split('|')[1]] ?? null }));
  fs.writeFileSync(`${OUT}/expected.json`, JSON.stringify(summary, null, 1));
  say('expected by biz|loc', summary);

  const reports = ['salesByStaff', 'salesByClients', 'salesByServices', 'finance', 'cashDay', 'pnl', 'retention', 'workload', 'appointments'];
  for (const slug of ONLY ?? reports) {
    await open(`/biz/reports/r/${slug}`);
    fs.writeFileSync(`${OUT}/${slug}.txt`, await page.innerText('main'));
    await page.screenshot({ path: `${OUT}/${slug}-desktop.png`, fullPage: true });
  }
} finally {
  fs.writeFileSync(`${OUT}/crosscheck.log`, log.join('\n'));
  await browser.close();
  release();
}
