// Обход всех экранов раздела: снимок + текст + консоль + вылет + сырые ключи
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/settings/explore';
const BASE = 'http://localhost:3710';
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });
const ROUTES = ['/biz/settings','/biz/billing','/biz/onboarding','/biz/coins','/biz/billing/terms','/biz/billing/checkout','/biz/billing/manage',
'/biz/onboarding/spheres','/biz/onboarding/sphere-request','/biz/onboarding/tour','/biz/onboarding/quick-start','/biz/onboarding/restore','/biz/onboarding/pricing',
'/biz/billing/checkout/result?status=paid','/biz/onboarding/invite/demo','/biz/settings/mobile-app','/biz/settings/gallery','/biz/settings/contacts','/biz/settings/brand',
'/biz/settings/sphere','/biz/settings/languages','/biz/settings/system','/biz/settings/add-location','/biz/settings/history','/biz/settings/account','/biz/settings/legal',
'/biz/settings/categories','/biz/settings/help','/biz/billing/invoices','/biz/billing/seats','/biz/settings/modules/journal'];
export async function run(browser, mode = 'owner-desktop') {
  const [persona, dev, lang = 'ru', extra = ''] = mode.split('-');
  const empty = mode.includes('empty');
  const p = persona;
  const ctx = await browser.newContext(dev === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); page.setDefaultNavigationTimeout(150000); page.setDefaultTimeout(60000);
  let errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || /i18n:missing|i18n:no-en/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 160)));
  await page.goto(`${BASE}/biz/onboarding?demo=${p}&lang=${lang}&theme=light&empty=${empty ? 1 : 0}${extra ? '&api=' + extra : ''}`);
  await page.waitForTimeout(1500);
  const routes = process.env.ROUTES ? process.env.ROUTES.split(',') : ROUTES;
  for (const r of routes) {
    errs = [];
    try {
      await page.goto(BASE + r, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(extra === 'slow' ? 4000 : 2200);
      const info = await page.evaluate(() => {
        const main = document.querySelector('main') || document.body;
        const txt = main.innerText.replace(/\s+/g, ' ');
        const raw = (txt.match(/\b[a-z]+\.[a-zA-Z]+\.[a-zA-Z.]+\b/g) || []).filter((x) => !/\.(am|com|ru|png|jpg)$/.test(x)).slice(0, 5);
        const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
        const busy = document.querySelectorAll('[aria-busy=true]').length;
        return { txt: txt.slice(0, 350), raw, overflow, busy };
      });
      const name = `${mode}__${r.replace(/[/?=]/g, '_')}`;
      await page.screenshot({ path: `${OUT}/${name}.png` });
      console.log(`${mode} ${r} | overflow=${info.overflow} busy=${info.busy} raw=${JSON.stringify(info.raw)} errs=${JSON.stringify(errs.slice(0, 3))}\n   ${info.txt}`);
    } catch (e) { console.log(`${mode} ${r} FAIL ${e.message.split('\n')[0]}`); }
  }
  await ctx.close();
}
