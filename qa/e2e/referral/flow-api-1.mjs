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
const persona = process.argv[2] ?? 'all';

await login('+37400160001', 'client');
await go('/profile/invite');
await shot('02-my-invites-phone');
const urls = await page.locator('[data-testid=share-url]').allInnerTexts();
const nuri = urls.find((u) => u.includes(`/b/${SLUG}?ref=`));
console.log('urls', urls);
const code = new URL(nuri).searchParams.get('ref');

await ctx.clearCookies();
await go(`/b/${SLUG}?ref=${code}`);
await page.locator('[data-testid=referral-welcome]').waitFor({ timeout: 20000 });
await shot('03-landing-banner-phone', false);

const PHONE_LOCAL = '99' + String(Date.now()).slice(-6);
await go(`/b/${SLUG}/book`);
await page.waitForTimeout(4000);
const solo = page.getByRole('button', { name: /Индивидуальная запись/ });
if (await solo.count()) { await solo.first().click(); await page.waitForTimeout(800); }
try { await page.locator('text="Маникюр аппаратный"').first().click({ timeout: 20000 }); } catch (e) { await page.screenshot({ path: `${OUT}/probe-api.png`, fullPage: true }); throw e; }
await page.waitForTimeout(500);
await cont();
await page.locator('button:has-text("Ани Саргсян")').first().click(); await page.waitForTimeout(1200);
const acc = page.locator('[role="dialog"]', { hasText: /Кого принимает/ });
if (await acc.count()) { await acc.getByRole('button', { name: 'Понятно' }).click(); await page.waitForTimeout(300); }
if (!(await page.getByText('Дата и время').first().isVisible().catch(() => false))) await cont();
const slot = page.getByRole('button', { name: /^\d\d:\d\d$/ }).last();
await slot.waitFor({ timeout: 20000 }); await page.mouse.wheel(0, 600); await page.waitForTimeout(300); await slot.click(); await page.waitForTimeout(500);
await cont();
await page.fill('input[placeholder="Введите имя"]', 'Ева Апишева');
await page.fill('input[type=tel]', PHONE_LOCAL);
await page.getByRole('button', { name: 'Получить код' }).click(); await page.waitForTimeout(1500);
const codeInput = page.locator('input[autocomplete="one-time-code"], input[placeholder="0000"]').first();
if (await codeInput.count()) {
  await codeInput.fill('0000');
  const confirm = page.getByRole('button', { name: 'Подтвердить' });
  if (await confirm.count()) { await confirm.click(); await page.waitForTimeout(800); }
}
const consent = page.locator('input[type=checkbox]').last();
if (await consent.count() && !(await consent.isChecked())) { await page.getByText('Согласен на обработку персональных данных').first().click(); await page.waitForTimeout(200); }
await page.screenshot({ path: `${OUT}/probe-api.png`, fullPage: true });
await page.getByRole('button', { name: 'Записаться' }).click();
await page.waitForURL(/\/booking\//, { timeout: 30000 });
await page.waitForTimeout(3500);
await page.locator('[data-testid=invite-friend]').scrollIntoViewIfNeeded().catch(() => {});
await shot('04-confirmed-widget-phone');
const bookingId = page.url().match(/booking\/([^?]+)/)[1];
console.log('B booking', bookingId, 'phone', PHONE_LOCAL);
import('node:fs').then((fs) => fs.writeFileSync(`${OUT}/api-state.json`, JSON.stringify({ code, bookingId, phone: '+374' + PHONE_LOCAL })));
console.log('errors', errors.slice(0, 10));
await browser.close(); release();

async function cont() {
  const b = page.locator('button:has-text("Продолжить"):not([disabled]):visible').first();
  try { await b.waitFor({ timeout: 15000 }); } catch (e) { await page.screenshot({ path: `${OUT}/probe-api.png`, fullPage: true }); throw e; }
  await b.click();
  await page.waitForTimeout(1200);
}
