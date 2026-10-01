// Режим api (копия :4023): консоль на страницах кабинета у владельца и администратора — гидрация, «script tag»
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const API = 'http://localhost:4023';
const PEOPLE = { owner: '+37400110001', admin: '+37400110002', master: '+37400110004' };
const pages = process.argv[2].split(',');
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  for (const spec of pages) {
    const [who, path] = spec.split(':');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.route('http://localhost:4010/**', (r) => r.continue({ url: r.request().url().replace(':4010', ':4023') }));
    execSync(`docker exec booktime-mysql-1 mysql -ubooktime -pbooktime booktime -e "update otp_requests set sent_at = sent_at - interval 2 day where sent_at > now() - interval 2 day"`, { stdio: 'ignore' });
    const h = { 'content-type': 'application/json', origin: 'http://localhost:3710' };
    await ctx.request.post(`${API}/v1/auth/code`, { headers: h, data: { phone: PEOPLE[who] } });
    await ctx.request.post(`${API}/v1/auth/verify`, { headers: h, data: { phone: PEOPLE[who], code: '0000', app: 'business' } });
    const page = await ctx.newPage();
    const msgs = [];
    page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/fallback-ru|DevTools/.test(m.text())) msgs.push(`[${m.type()}] ${m.text().slice(0, 1500)}`); });
    page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message.slice(0, 600)}`));
    await page.goto(`http://localhost:3710${path}?data=api`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForTimeout(8000);
    console.log(`\n=== api ${who} ${path} → ${page.url()}\n${msgs.join('\n') || '(консоль чистая)'}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  release();
}
