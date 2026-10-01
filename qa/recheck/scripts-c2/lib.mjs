import { createRequire } from 'node:module';
const require = createRequire('/Users/arsen/WebstormProjects/booking-platform/package.json');
const { chromium } = require('@playwright/test');
export const BASE = 'http://localhost:3710';
export const SHOTS = new URL('../shots-c2/', import.meta.url).pathname;
const DEV = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 } },
};
let browser;
export async function start() { browser = await chromium.launch(); return browser; }
export async function stop() { await browser?.close(); }
export async function open(persona, route, { device = 'desktop', lang = 'ru', sphere = 'nails', ctx } = {}) {
  const context = ctx ?? await browser.newContext({ ...DEV[device], locale: lang === 'ru' ? 'ru-RU' : 'en-US' });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', e => { const m='pageerror: ' + e.message.slice(0,200); if(!page.errors.includes(m)) page.errors.push(m); });
  page.on('console', m => { if (m.type() === 'error' || m.type()==='warning') { const x=m.type()+': ' + m.text().slice(0, 200); if(!page.errors.includes(x)) page.errors.push(x);} });
  const sep = route.includes('?') ? '&' : '?';
  await safeGoto(page, `${BASE}${route}${sep}demo=${persona}&sphere=${sphere}&lang=${lang}&theme=light`);
  await settle(page);
  await page.addStyleTag({ content: '[data-demo-fab]{display:none!important}' }).catch(()=>{});
  return { context, page };
}
async function overlay(page) { return page.evaluate(() => !!document.querySelector('nextjs-portal') && /Error|Failed to compile|Build Error/.test(document.querySelector('nextjs-portal')?.shadowRoot?.textContent || '') && !document.querySelector('main')).catch(()=>false); }
export async function settle(page, ms = 1500) {
  for (let k = 0; k < 8; k++) { await page.waitForLoadState('domcontentloaded').catch(()=>{}); await page.waitForTimeout(500); if (!(await overlay(page))) break; console.log('[compile error overlay — retry in 15s]'); await page.waitForTimeout(15000); await page.reload({ waitUntil: 'domcontentloaded' }).catch(()=>{}); }
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[data-skeleton]'), null, { timeout: 60000 }).catch(() => { page.errors?.push('SKELETON STILL AFTER 60s'); });
  await page.waitForTimeout(ms);
}
export async function go(page, route) { await safeGoto(page, BASE + route); await settle(page); await page.addStyleTag({ content: '[data-demo-fab]{display:none!important}' }).catch(()=>{}); }
export async function shot(page, name, full = false) { await page.screenshot({ path: SHOTS + name + '.png', fullPage: full }); }
export async function text(page, sel = 'main') { const l = page.locator(sel).first(); return (await l.count()) ? (await l.innerText()).replace(/\s+\n/g, '\n') : (await page.locator('body').innerText()); }
export async function db(page) { await page.waitForFunction(() => !!localStorage.getItem('bp-mock-db'), null, { timeout: 30000 }).catch(()=>{}); return page.evaluate(() => { const r = JSON.parse(localStorage.getItem('bp-mock-db') || 'null'); return r?.state ?? r; }); }

export async function safeGoto(page, url) {
  for (let i = 0; i < 3; i++) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 }); return; }
    catch (e) { if (i === 2) throw e; await page.waitForTimeout(3000); }
  }
}
export async function as(page, persona, route, extra = '') {
  const sep = route.includes('?') ? '&' : '?';
  await safeGoto(page, `${BASE}${route}${sep}demo=${persona}${extra}`);
  await settle(page);
  await page.addStyleTag({ content: '[data-demo-fab]{display:none!important}' }).catch(()=>{});
}
export async function reload(page) { await page.reload({ waitUntil: 'domcontentloaded' }); await settle(page); }
export async function toasts(page) { return page.$$eval('[data-sonner-toast], [role=status], [role=alert]', els => els.map(e => e.innerText.trim()).filter(Boolean)).catch(()=>[]); }
export async function btnTexts(page, sel='button') { return page.$$eval(sel, els => els.filter(e=>e.offsetParent!==null).map(e => (e.innerText||e.getAttribute('aria-label')||'').trim().replace(/\s+/g,' '))); }
export async function pick(page, combo, option) {
  await combo.click(); await page.waitForTimeout(400);
  const o = page.getByRole('option', { name: option, exact: true });
  await o.last().click(); await page.waitForTimeout(400);
}
export async function wizardToDetails(page, { staff = 'Гаяне Оганесян', service = 'Маникюр классический', log = false } = {}) {
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(700);
    if (await page.getByPlaceholder('Введите имя').count()) return true;
    const body = await page.locator('main, body').first().innerText();
    if (log) console.log('[wizard step]', body.slice(0, 160).replace(/\n/g, ' | '));
    if (await page.getByRole('button', { name: 'Индивидуальная запись' }).count()) { await page.getByRole('button', { name: 'Индивидуальная запись' }).click(); continue; }
    const time = page.locator('button').filter({ hasText: /^\d{1,2}:\d{2}$/ });
    if (await time.count()) await time.first().click();
    else if (staff && body.includes(staff) && /Мастер|Специалист|Сотрудник/.test(body) && !body.includes(service)) await page.getByText(staff).first().click();
    else if (body.includes(service)) await page.getByText(service).first().click();
    else if (staff && body.includes(staff)) await page.getByText(staff).first().click();
    await page.waitForTimeout(300);
    const cont = page.getByRole('button', { name: /Продолжить/ });
    if (await cont.count() && await cont.first().isEnabled()) await cont.first().click();
  }
  return false;
}
