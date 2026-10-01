// «Пригласи подругу» — полный путь в моке: A делится ссылкой → B записывается по ссылке → B пришла и оплатила → бонус A.
// Запуск из корня репозитория: node qa/e2e/referral/<файл>.mjs (снимки — qa/shots/referral). api-сценарий ждёт копию
// сервера на :4011 над базой booktime_referral_qa с применённой миграцией 20261001170000_client_referrals.
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/referral';
const SLUG = 'nuri-nail-studio';
let LANG = process.env.LANG_UI ?? 'ru';
const STEP = process.env.STEP ?? 'all';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errors.push(m.text().slice(0, 200)); });
const VP = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
async function go(persona, route, device = 'phone') {
  await page.setViewportSize(VP[device]);
  const sep = route.includes('?') ? '&' : '?';
  await page.goto(`${BASE}${route}${sep}demo=${persona}&lang=${LANG}&theme=light&api=normal`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => !document.querySelector('[data-skeleton]'), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);
  // туры первого входа
  for (let i = 0; i < 5; i++) {
    const close = page.getByRole('button', { name: /^(Закрыть|Пропустить|Close|Skip)$/ }).first();
    if (await close.isVisible().catch(() => false)) { await close.click().catch(() => {}); await page.waitForTimeout(300); } else break;
  }
}
async function shot(name, full = true) { await page.screenshot({ path: `${OUT}/${name}-${LANG}.png`, fullPage: full }); console.log('shot', name); }
async function coll(key) {
  await page.waitForTimeout(800);
  return page.evaluate((k) => { const raw = localStorage.getItem(k); if (!raw) return undefined; const v = JSON.parse(raw); return v.state ?? v; }, key);
}
async function keys() { return page.evaluate(() => Object.keys(localStorage)); }

// ── A: своя ссылка ──
await go('client', '/profile');
await shot('01-profile-entry-phone', false);
await go('client', '/profile/invite');
await shot('02-my-invites-phone');
await go('client', '/profile/invite', 'desktop');
await shot('02-my-invites-desktop', false);
const urls = await page.locator('[data-testid=share-url]').allInnerTexts();
const nuri = urls.find((u) => u.includes(`/b/${SLUG}?ref=`));
if (!nuri) throw new Error('нет ссылки Nuri: ' + urls.join(', '));
const code = new URL(nuri).searchParams.get('ref');
console.log('A link', nuri);
console.log('keys', (await keys()).join(', '));
fs_write('state.json', { code });

// ── B: открыла ссылку ──
await go('guest', `/b/${SLUG}?ref=${code}`);
await page.locator('[data-testid=referral-welcome]').waitFor({ timeout: 20000 });
await shot('03-landing-banner-phone', false);
await go('guest', `/b/${SLUG}?ref=${code}`, 'desktop');
await shot('03-landing-banner-desktop', false);

// ── B: запись по ссылке ──
const local = '9' + String(Math.floor(10000000 + Math.random() * 89999999)).slice(0, 7);
const PHONE_LOCAL = process.env.PHONE_LOCAL ?? ('99' + String(Date.now()).slice(-6));
await go('guest', `/b/${SLUG}/book`);
const solo = page.getByRole('button', { name: /Индивидуальная запись|Individual/ });
if (await solo.count()) { await solo.first().click(); await page.waitForTimeout(600); }
await page.waitForTimeout(3000);
const svc = page.locator('text="Маникюр классический"').first();
await svc.click(); await page.waitForTimeout(500);
await cont();
await page.locator('button:has-text("Ани Саргсян")').first().click(); await page.waitForTimeout(500);
const acc = page.locator('[role="dialog"]', { hasText: /Кого принимает/ });
if (await acc.count()) { await acc.getByRole('button', { name: 'Понятно' }).click(); await page.waitForTimeout(300); }
await page.waitForTimeout(800);
if (!(await page.getByText('Дата и время').first().isVisible().catch(() => false))) await cont();
const slot = page.getByRole('button', { name: /^\d\d:\d\d$/ }).last();
await slot.waitFor({ timeout: 15000 }); await page.mouse.wheel(0, 600); await page.waitForTimeout(300); await slot.click(); await page.waitForTimeout(500);
await cont();
await page.screenshot({ path: `${OUT}/probe-fail.png`, fullPage: true });
await page.fill('input[placeholder="Введите имя"]', 'Мари Подругова');
await page.fill('input[type=tel]', PHONE_LOCAL);
await page.getByRole('button', { name: 'Получить код' }).click(); await page.waitForTimeout(800);
const toastText = (await page.locator('[data-sonner-toast], [role=status], [role=alert]').allInnerTexts()).join(' ');
const otp = (toastText.match(/\b(\d{4})\b/) ?? [])[1] ?? '0000';
console.log('toast', toastText.slice(0, 120)); await page.screenshot({ path: `${OUT}/probe-fail.png`, fullPage: true });
console.log('inputs', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => [i.type, i.placeholder, i.name, i.autocomplete, i.inputMode, i.maxLength]))));
if (await page.locator('input[placeholder="0000"]').count()) {
  await page.fill('input[placeholder="0000"]', otp);
  await page.getByRole('button', { name: 'Подтвердить' }).click(); await page.waitForTimeout(600);
}
const consent = page.locator('input[type=checkbox]').last();
if (await consent.count() && !(await consent.isChecked())) { await page.getByText('Согласен на обработку персональных данных').first().click(); await page.waitForTimeout(200); }
await page.getByRole('button', { name: 'Записаться' }).click();
await page.waitForURL(/\/booking\//, { timeout: 30000 });
await page.waitForTimeout(2500);
await page.locator('[data-testid=invite-friend]').scrollIntoViewIfNeeded().catch(() => {});
await shot('04-confirmed-widget-phone');
var confirmedUrl = page.url();
const clients = await coll('bp-mock-db:core:clients');
const list = Array.isArray(clients) ? clients : clients?.clients ?? clients;
const B = list.find((c) => c.phone === '+374' + PHONE_LOCAL);
const A = list.find((c) => c.referralCode === code);
console.log('A', A?.id, A?.name, 'B', B?.id, B?.name, 'B.referredBy', B?.referredByClientId);
if (!B || B.referredByClientId !== A.id) throw new Error('привязка не поставлена');
fs_write('state.json', { code, A: A.id, B: B.id, confirmedUrl });

// ── кабинет: карточка B и A ──
await go('admin', `/biz/clients/${B.id}`, 'desktop');
await page.locator('[data-testid=referred-by]').waitFor({ timeout: 20000 });
await shot('05-client-card-invitee-desktop', false);
await go('admin', `/biz/clients/${B.id}`);
await shot('05-client-card-invitee-phone', false);
await go('admin', `/biz/clients/${A.id}`, 'desktop');
await page.locator('[data-testid=referral-invitees]').waitFor({ timeout: 20000 });
await shot('06-client-card-referrer-desktop', false);

// ── B пришла: оплата визита в окне записи — строка «Скидка по приглашению» подставляется сама ──
const bookings = await page.evaluate(() => { const raw = localStorage.getItem('bp-mock-db:core:bookings'); return raw ? JSON.parse(raw) : null; });
const bk = (await getBookings()).find((b) => b.clientId === B.id);
console.log('B booking', bk?.id, bk?.start, bk?.status);
await go('admin', `/biz/journal?date=${bk.start.slice(0, 10)}&booking=${bk.id}`, 'desktop');
await page.waitForTimeout(2500);
if (!(await page.locator('[role=dialog]').count())) { await page.getByText('Мари П.').first().click(); await page.waitForTimeout(2500); }
await shot('07-booking-window-desktop', false);
const dlg = page.locator('[role=dialog]').first();
await dlg.getByRole('tab', { name: 'Лояльность' }).click();
await page.waitForTimeout(2500);
await shot('08-pay-loyalty-tab-desktop', false);
console.log('loyalty tab', (await dlg.innerText()).replace(/\n+/g, ' | ').slice(0, 400));
if (!(await dlg.getByText(/Скидка по приглашению/).count())) throw new Error('строка приглашения не подставилась');
await dlg.getByRole('button', { name: 'Провести оплату' }).click();
await page.waitForTimeout(3000);
await shot('09-pay-committed-desktop', false);
const toasts = (await page.locator('[data-sonner-toast], [role=status]').allInnerTexts()).join(' / ');
console.log('toasts', toasts.slice(0, 200));
const bk2 = (await getBookings()).find((b) => b.id === bk.id);
console.log('B status after pay', bk2.status);

// ── A видит бонус ──
await go('client', '/profile/invite');
await page.getByText(/Бонус начислен|Bonus received/).first().waitFor({ timeout: 20000 });
await shot('10-my-invites-rewarded-phone');
await go('client', '/profile/invite', 'desktop');
await shot('10-my-invites-rewarded-desktop', false);
await go('client', '/profile');
await shot('11-profile-entry-stats-phone', false);
await go('admin', `/biz/clients/${A.id}`);
await shot('12-client-card-referrer-phone', false);
// ── English: те же экраны ──
LANG = 'en';
await go('client', '/profile/invite');
await shot('10-my-invites-rewarded-phone');
await go('client', '/profile/invite', 'desktop');
await shot('10-my-invites-rewarded-desktop', false);
await go('guest', `/b/${SLUG}?ref=${code}`);
await page.locator('[data-testid=referral-welcome]').waitFor({ timeout: 20000 });
await shot('03-landing-banner-phone', false);
await page.goto(confirmedUrl, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
await page.locator('[data-testid=invite-friend]').scrollIntoViewIfNeeded().catch(() => {});
await shot('04-confirmed-widget-phone', false);
await go('admin', `/biz/clients/${B.id}`, 'desktop');
await shot('05-client-card-invitee-desktop', false);
await go('admin', `/biz/journal?date=${bk.start.slice(0, 10)}`, 'desktop');
console.log('errors', errors.slice(0, 10));
await browser.close(); release();

async function cont() {
  const b = page.locator('button:has-text("Продолжить"):not([disabled]):visible').first();
  try { await b.waitFor({ timeout: 15000 }); } catch (e) { await page.screenshot({ path: `${OUT}/probe-fail.png`, fullPage: true }); throw e; }
  await b.click();
  await page.waitForTimeout(900);
}
async function getBookings() {
  await page.waitForTimeout(600);
  return page.evaluate(async () => {
    const raw = localStorage.getItem('bp-mock-db:core:bookings');
    if (raw) return JSON.parse(raw);
    return null;
  });
}
function fs_write(name, obj) { import('node:fs').then((fs) => fs.writeFileSync(`${OUT}/${name}`, JSON.stringify(obj, null, 2))); }
