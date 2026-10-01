// Зоны нажатия в журнале (имя мастера в шапке, «Технический перерыв») + меню-шторка на телефоне без «script tag»
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/leftovers';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = (...a) => console.log(...a);
try {
  for (const [device, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    await page.goto(`${BASE}/biz/journal?date=2026-10-02&demo=owner`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForTimeout(7000);
    const heads = await page.locator('[data-f="F-01-020 F-01-126 F-02-025"] button').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    log(device, 'header name buttons heights:', heads.join(','));
    const breaks = await page.locator('button[data-f="F-01-032 F-02-062"]').evaluateAll((els) =>
      els.slice(0, 4).map((e) => {
        e.scrollIntoView({ block: 'center' });
        const r = e.getBoundingClientRect();
        const at = (dy) => { const h = document.elementFromPoint(r.left + r.width / 2, r.top + dy); return h === e ? 'self' : (h?.tagName + '.' + String(h?.className).slice(0, 40)); };
        return `${Math.round(r.height)}px, @8=${at(8)} @20=${at(20)} @36=${at(36)}`;
      }),
    );
    log(device, 'breaks:', breaks.join(' ; '));
    await page.screenshot({ path: `${OUT}/v4-journal-${device}.png` });
    if (device === 'phone') {
      await page.getByRole('button', { name: /меню/i }).first().click().catch((e) => log('menu btn', e.message.slice(0, 80)));
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/v4-drawer-phone.png` });
    }
    log(device, 'console errors:', errs.length, errs.filter((e) => /script tag|Hydration/i.test(e)).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
  release();
}
