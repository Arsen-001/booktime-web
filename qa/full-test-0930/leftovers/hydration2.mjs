// Та же проверка, но роли переключаются в ОДНОМ контексте (как у проверяющих)
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const steps = (process.argv[2] ?? 'owner:/biz/journal,admin:/biz/notifications,admin:/biz/notifications/types,admin:/biz/notifications/inbox,owner:/biz/reports,master:/biz/journal').split(',');
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let msgs = [];
  page.on('console', (m) => { if (m.type() === 'error') msgs.push(`[${m.type()}] ${m.text().slice(0, 2500)}`); });
  page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message.slice(0, 9000)}`));
  for (const spec of steps) {
    const [persona, path] = spec.split(':');
    msgs = [];
    await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}demo=${persona}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForTimeout(7000);
    console.log(`\n=== ${persona} ${path}\n${msgs.join('\n') || '(консоль чистая)'}`);
  }
} finally {
  await browser.close();
  release();
}
