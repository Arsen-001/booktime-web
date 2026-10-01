// Консоль: гидрация и «script tag» на страницах кабинета у разных персон
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const pages = (process.argv[2] ?? 'admin:/biz/notifications,owner:/biz/reports,owner:/biz/journal,owner:/biz/onboarding').split(',');
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  for (const spec of pages) {
    const [persona, path] = spec.split(':');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const msgs = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') msgs.push(`[${m.type()}] ${m.text().slice(0, 1500)}`); });
    page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message.slice(0, 800)}`));
    await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}demo=${persona}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/leftovers/h-${persona}-${path.replace(/\W+/g, '_')}.png` });
    console.log(`\n=== ${persona} ${path} → ${page.url()}\n${msgs.join('\n') || '(консоль чистая)'}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  release();
}
