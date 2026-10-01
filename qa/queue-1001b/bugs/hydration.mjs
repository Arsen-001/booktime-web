// Консоль: гидрация и «script tag» на страницах кабинета у разных персон (в т. ч. пустые)
// node qa/queue-1001b/bugs/hydration.mjs "owner:/biz/journal,admin:/biz/notifications,owner*:/biz/reports"   (* — пустой бизнес)
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/queue-1001b/bugs';
const pages = process.argv[2].split(',');
const shots = process.argv.includes('--shots');
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
let dirty = 0;
try {
  for (const spec of pages) {
    let [persona, path] = spec.split(':');
    const empty = persona.endsWith('*');
    persona = persona.replace('*', '');
    const ctx = await browser.newContext({ viewport: process.env.VP === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const msgs = [];
    page.on('console', (m) => {
      const s = m.text();
      if ((m.type() === 'error' || m.type() === 'warning') && !/i18n:fallback-ru|Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(s)) msgs.push(`[${m.type()}] ${s.slice(0, 2500)}`);
    });
    page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message.slice(0, 800)}`));
    await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}demo=${persona}&empty=${empty ? 1 : 0}&data=mock${process.env.EXTRA ?? ''}`, { waitUntil: 'domcontentloaded', timeout: 240000 }).catch(() => {});
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForTimeout(7000);
    if (shots) await page.screenshot({ path: `${OUT}/h-${process.env.VP ?? 'desktop'}-${persona}${empty ? '-empty' : ''}-${path.replace(/\W+/g, '_')}.png` });
    if (msgs.length) dirty++;
    console.log(`\n=== ${persona}${empty ? ' (пусто)' : ''} ${path} → ${page.url()}\n${msgs.join('\n') || '(консоль чистая)'}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  release();
}
console.log(`\nстраниц с сообщениями: ${dirty} из ${pages.length}`);
