// «Пригласи подругу» в режиме api: сервер-копия на :4011 (база booktime_referral_qa с применённой миграцией),
// браузер ходит на :4010 — запросы перенаправляются на :4011.
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const API = 'http://localhost:4011';
const OUT = 'qa/shots/referral';
const SLUG = 'nuri-nail-studio';
let LANG = 'ru';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('http://localhost:4010/**', async (route) => {
  const url = route.request().url().replace('http://localhost:4010', API);
  try {
    const resp = await route.fetch({ url });
    if (resp.status() >= 400) console.log('API', resp.status(), route.request().method(), url.slice(0, 120), (await resp.text()).slice(0, 200));
    await route.fulfill({ response: resp });
  } catch (e) { console.log('ROUTE FAIL', route.request().method(), url, String(e).slice(0, 200)); await route.abort(); }
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text().slice(0, 200)); });
const VP = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
async function go(route, device = 'phone') {
  await page.setViewportSize(VP[device]);
  const sep = route.includes('?') ? '&' : '?';
  await page.goto(`${BASE}${route}${sep}data=api&lang=${LANG}&theme=light&api=normal`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => !document.querySelector('[data-skeleton]'), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
}
async function shot(name, full = true) { await page.screenshot({ path: `${OUT}/api-${name}-${LANG}.png`, fullPage: full }); console.log('shot', name); }
async function login(phone, app) {
  await ctx.clearCookies();
  for (let i = 0; i < 3; i++) {
    const c = await ctx.request.post(`${API}/v1/auth/code`, { data: { phone } });
    if (c.ok()) break;
    const wait = Number((await c.json().catch(() => ({}))).retryAfter ?? 5);
    console.log('code wait', wait);
    if (wait > 120) throw new Error("rate limited " + wait); await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
  }
  const r = await ctx.request.post(`${API}/v1/auth/verify`, { data: { phone, code: '0000', app, consent: true } });
  console.log('login', phone, app, r.status(), (await r.text()).slice(0, 120));
  console.log('cookies', (await ctx.cookies()).map((c) => `${c.name}@${c.domain}`).join(','));
}

import fs from 'node:fs';
import { execSync } from 'node:child_process';
const st = JSON.parse(fs.readFileSync(`${OUT}/api-state.json`, 'utf8'));
const q = (sql) => execSync(`docker exec booktime-mysql-1 mysql -N -ubooktime -pbooktime booktime_referral_qa -e "${sql}"`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const B = q(`select id from clients where business_id='biz_nuri' and phone='${st.phone}' and deleted_at is null`);
const link = q(`select concat(invitee_client_id,' ',referrer_client_id,' ',code) from client_referrals where invitee_client_id='${B}'`);
console.log('B', B, 'referral row', link);
const A = link.split(' ')[1];

await login('+37400110002', 'business');
await go(`/biz/clients/${B}`, 'desktop');
await page.locator('[data-testid=referred-by]').waitFor({ timeout: 30000 });
await shot('05-client-card-invitee-desktop', false);
await go(`/biz/clients/${B}`);
await shot('05-client-card-invitee-phone', false);
const start = q(`select date_format(convert_tz(start_at,'+00:00','+04:00'),'%Y-%m-%d') from bookings where id='${st.bookingId}'`);
await go(`/biz/journal?date=${start}&booking=${st.bookingId}`, 'desktop');
await page.waitForTimeout(3000);
if (!(await page.locator('[role=dialog]').count())) { await page.getByText('Ева А.').first().click(); await page.waitForTimeout(3000); }
const dlg = page.locator('[role=dialog]').first();
await dlg.getByRole('tab', { name: 'Лояльность' }).click();
await page.waitForTimeout(4000);
await shot('08-pay-loyalty-tab-desktop', false);
console.log('loyalty', (await dlg.innerText()).replace(/\n+/g, ' | ').slice(0, 400));
await dlg.getByRole('button', { name: 'Провести оплату' }).click();
await page.waitForTimeout(4000);
await shot('09-pay-committed-desktop', false);
console.log('status', q(`select status from bookings where id='${st.bookingId}'`));
console.log('accrual', q(`select concat(client_id,' ',amount,' ',json_unquote(json_extract(data,'$.type'))) from loyalty_tx where booking_id='${st.bookingId}'`));
await go(`/biz/clients/${A}`);
await shot('12-client-card-referrer-phone', false);

await login('+37400160001', 'client');
await go('/profile/invite');
await shot('10-my-invites-rewarded-phone');
await go('/profile/invite', 'desktop');
await shot('10-my-invites-rewarded-desktop', false);
LANG = 'en';
await go('/profile/invite');
await shot('10-my-invites-rewarded-phone');
console.log('errors', errors.slice(0, 10));
await browser.close(); release();
