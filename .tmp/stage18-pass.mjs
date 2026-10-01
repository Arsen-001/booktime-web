import fs from 'node:fs';
import { chromium } from 'playwright';
const BASE = 'http://localhost:3710';
function jarCookies(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l && (!l.startsWith('#') || l.startsWith('#HttpOnly_'))).map((l) => {
    const [domain, , p, secure, , name, value] = l.replace('#HttpOnly_', '').split('\t');
    return { name, value, domain: 'localhost', path: p, httpOnly: l.startsWith('#HttpOnly_'), secure: secure === 'TRUE' };
  });
}
const [jar, bizId, ...extra] = process.argv.slice(2);
const routes = [
  '/biz/billing', '/biz/billing/checkout', '/biz/billing/checkout/result', '/biz/billing/invoices', '/biz/billing/manage', '/biz/billing/seats', '/biz/billing/terms',
  '/biz/coins', '/biz/onboarding', '/biz/onboarding/pricing', '/biz/onboarding/quick-start', '/biz/onboarding/sphere-request', '/biz/onboarding/spheres', '/biz/onboarding/tour',
  '/biz/settings', '/biz/settings/account', '/biz/settings/brand', '/biz/settings/categories', '/biz/settings/contacts', '/biz/settings/gallery', '/biz/settings/help',
  '/biz/settings/history', '/biz/settings/languages', '/biz/settings/legal', '/biz/settings/mobile-app', '/biz/settings/sphere', '/biz/settings/system', '/biz/settings/add-location',
  ...extra,
];
const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addCookies([...jarCookies(jar), { name: 'bt_data', value: 'api', domain: 'localhost', path: '/' }]);
const out = [];
for (const r of routes) {
  const p = await ctx.newPage();
  const errs = [];
  const api = new Set();
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().split('\n')[0].slice(0, 160)); });
  p.on('response', (res) => { const u = res.url(); if (u.includes(':4010/v1/biz/')) api.add(`${res.status()} ${res.request().method()} ${u.replace(/.*:4010/, '').replace(/\?.*/, '')}`); });
  let status = 0;
  try {
    const res = await p.goto(BASE + r, { waitUntil: 'networkidle', timeout: 60000 });
    status = res?.status() ?? 0;
    await p.waitForTimeout(1200);
  } catch (e) { errs.push('GOTO ' + e.message.slice(0, 100)); }
  const text = (await p.locator('body').innerText().catch(() => '')).trim();
  const bad = [];
  if (/NaN|undefined|\[object Object\]/.test(text)) bad.push('NaN/undefined в тексте');
  if (/Что-то пошло не так|Something went wrong|Здесь нет доступа/i.test(text)) bad.push('экран ошибки/нет доступа');
  if (text.length < 40) bad.push('пусто');
  const apiBad = [...api].filter((a) => !/^2\d\d/.test(a));
  const mine = [...api].filter((a) => /billing|coins|company|onboarding|record-categories|help-requests|sphere-requests|mobile-app|me\/prefs/.test(a));
  out.push({ r, status, errs: [...new Set(errs)].slice(0, 3), bad, apiBad, mine: mine.length });
  console.log(`${bad.length || errs.length || apiBad.length ? 'FAIL' : 'ok  '} ${status} ${r}  api:${api.size} (раздел ${mine.length}) ${[...bad, ...errs.slice(0, 2), ...apiBad.slice(0, 3)].join(' | ')}`);
  await p.close();
}
await browser.close();
const fails = out.filter((o) => o.bad.length || o.errs.length || o.apiBad.length);
console.log(`ИТОГО ${out.length} маршрутов, с проблемами ${fails.length}`);
