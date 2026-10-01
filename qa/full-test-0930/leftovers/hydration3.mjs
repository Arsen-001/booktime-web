import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=owner`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForTimeout(6000);
  await page.goto(`${BASE}/biz/notifications?demo=admin`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForTimeout(6000);
  console.log('cookies', JSON.stringify((await ctx.cookies()).map((c) => `${c.name}=${c.value}`)));
  const html = await (await page.request.get(`${BASE}/biz/notifications`)).text();
  const nav = html.slice(html.indexOf('aria-label="Основное меню"'), html.indexOf('</nav>', html.indexOf('aria-label="Основное меню"')));
  const serverLabels = [...nav.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
  const clientLabels = await page.$$eval('nav[aria-label="Основное меню"] a', (as) => as.map((a) => a.getAttribute('href')));
  console.log('server', serverLabels.join(' '));
  console.log('client', clientLabels.join(' '));
} finally {
  await browser.close();
  release();
}
