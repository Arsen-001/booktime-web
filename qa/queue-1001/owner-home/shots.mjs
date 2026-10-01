// Снимки главной владельца: node qa/queue-1001/owner-home/shots.mjs <case,...>
// case = mode:persona:lang:device[:empty]  (mode mock|api). Режим api берёт cookie сессии из final-api/sessions.json.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const DIR = '/Users/arsen/WebstormProjects/booking-platform/qa/queue-1001/owner-home/shots';
fs.mkdirSync(DIR, { recursive: true });
const B = 'http://localhost:3710';
const cases = (process.argv[2] ?? 'mock:owner:ru:desktop').split(',');
const extraPath = process.argv[3] ?? '/biz';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const out = [];
try {
  for (const c of cases) {
    const [mode, persona, lang, device, empty] = c.split(':');
    const vp = device === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
    const ctx = await browser.newContext({ viewport: vp, locale: lang === 'en' ? 'en-US' : 'ru-RU' });
    const cookies = [
      { name: 'bt_data', value: mode, domain: 'localhost', path: '/' },
      { name: 'lang', value: lang, domain: 'localhost', path: '/' },
    ];
    if (mode === 'api') {
      const s = JSON.parse(fs.readFileSync('/Users/arsen/WebstormProjects/booking-platform/qa/queue-1001/owner-home/sessions.json', 'utf8'));
      cookies.push(...s[persona]);
    }
    await ctx.addCookies(cookies);
    // Копия API с новым маршрутом на :4011 (основной :4010 не перезапускаем — у соседей не применены миграции)
    if (process.env.API_PORT) await ctx.route('http://localhost:4010/**', (route) => route.continue({ url: route.request().url().replace(':4010', `:${process.env.API_PORT}`) }));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 200)}`));
    page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('i18n')) errors.push(`console ${m.text().slice(0, 200)}`); });
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('_next')) errors.push(`HTTP ${r.status()} ${r.url().slice(0, 140)}`); });
    const q = new URLSearchParams({ lang, data: mode });
    if (mode === 'mock') { q.set('demo', persona); q.set('empty', empty ? '1' : '0'); }
    await page.goto(`${B}${extraPath}?${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2500);
    const name = `${mode}-${persona}${empty ? '-empty' : ''}-${lang}-${device}${extraPath === '/biz' ? '' : extraPath.replaceAll('/', '_')}`;
    await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true });
    const text = (await page.innerText('main').catch(() => '')).replace(/\s+/g, ' ').slice(0, 900);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    out.push({ name, url: page.url(), overflow, errors: [...new Set(errors)].slice(0, 10), text });
    await ctx.close();
  }
} finally {
  await browser.close();
  release();
}
console.log(JSON.stringify(out, null, 1));
