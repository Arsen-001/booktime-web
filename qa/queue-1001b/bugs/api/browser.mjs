// Режим api в браузере против копии сервера :4023: лента клиента («Освободилось время») и «Требует внимания» владельца
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/queue-1001b/bugs';
const API = 'http://localhost:4023';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = (...a) => console.log(...a);
async function session(phone, app, vp) {
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.route('http://localhost:4010/**', (r) => r.continue({ url: r.request().url().replace(':4010', ':4023') }));
  execSync(`docker exec booktime-mysql-1 mysql -ubooktime -pbooktime booktime -e "update otp_requests set sent_at = sent_at - interval 2 day where sent_at > now() - interval 2 day"`, { stdio: 'ignore' });
  const h = { 'content-type': 'application/json', origin: 'http://localhost:3710' };
  await ctx.request.post(`${API}/v1/auth/code`, { headers: h, data: { phone } });
  const r = await ctx.request.post(`${API}/v1/auth/verify`, { headers: h, data: { phone, code: '0000', app, consent: true } });
  log('вход', phone, r.status());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('pageerror', e.message.slice(0, 200)));
  await page.goto('http://localhost:3710/?data=api', { waitUntil: 'domcontentloaded', timeout: 240000 });
  return { ctx, page };
}
try {
  for (const [device, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]]) {
    const { ctx, page } = await session('+37400990030', 'client', vp);
    await page.goto('http://localhost:3710/notifications', { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForTimeout(6000);
    log(device, 'лента:', await page.getByText(/Освободилось время/).first().innerText().catch(() => 'none'));
    log(device, 'кнопок «Записаться» (F-00-101):', await page.locator('[data-f="F-00-101"]').count());
    await page.screenshot({ path: `${OUT}/api-n1-client-notif-${device}.png` });
    await ctx.close();
    const o = await session('+37400110001', 'business', vp);
    await o.page.goto('http://localhost:3710/biz/journal', { waitUntil: 'domcontentloaded', timeout: 240000 });
    await o.page.waitForTimeout(8000);
    const body = await o.page.locator('body').innerText();
    log(device, 'журнал: «Вернуть предоплату»:', /Вернуть предоплату|Верните клиенту/.test(body), '|', (body.match(/Вернуть предоплату[^\n]*/) ?? [''])[0]);
    await o.page.screenshot({ path: `${OUT}/api-n3-journal-${device}.png` });
    await o.ctx.close();
  }
} finally {
  await browser.close();
  release();
}
