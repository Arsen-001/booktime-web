// Общий помощник сценариев проверяющего online (30.09)
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
import path from 'node:path';
export const BASE = 'http://localhost:3710';
export const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/online';
let shared;
export async function closeShared() { if (shared) { await shared.browser.close(); shared.release(); shared = undefined; } }
export async function start({ device = 'phone' } = {}) {
  if (!shared) { const release = await acquireBrowserSlot(); shared = { release, browser: await chromium.launch() }; }
  const browser = shared.browser;
  const release = () => {};
  const vp = device === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: device === 'phone' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  const h = {
    page, ctx, browser, errors,
    async go(route, persona = 'client', extra = '') {
      const sep = route.includes('?') ? '&' : '?';
      const apiPart = /api=/.test(extra) ? '' : '&api=normal';
      await page.goto(`${BASE}${route}${sep}demo=${persona}&lang=ru&theme=light${apiPart}${extra}`, { waitUntil: 'domcontentloaded', timeout: 180000 }).catch(async () => { await page.goto(`${BASE}${route}${sep}demo=${persona}&lang=ru&theme=light${apiPart}${extra}`, { waitUntil: "domcontentloaded", timeout: 180000 }); });
      await h.settle();
      for (let i = 0; i < 3; i++) {
        const tour = page.locator('[role="dialog"]').filter({ hasText: /Шаг \d+ из \d+/ });
        if (!(await tour.count())) break;
        const c = tour.last().getByRole('button', { name: /^(Закрыть|Пропустить|Понятно)$/ }).first();
        if (!(await c.count())) break;
        await c.click().catch(() => {}); await page.waitForTimeout(300);
      }
    },
    async settle(extra = 400) {
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForFunction(() => ![...document.querySelectorAll('[aria-busy="true"],[data-skeleton]')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(extra);
    },
    async text() { return page.evaluate(() => document.body.innerText); },
    async shot(name, full = false) { await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: full, timeout: 90000 }).catch((e) => console.log('shot fail', name, e.message.slice(0, 80))); },
    async setDevice(d) { await page.setViewportSize(d === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 }); },
    /** Мок-база хранит на диске только изменённые коллекции: bp-mock-db:core:<коллекция>, bp-mock-db:area:<раздел> */
    async db() {
      await page.waitForTimeout(900);
      return page.evaluate(() => {
        const read = (k) => { try { const r = localStorage.getItem(k); if (!r) return null; const j = JSON.parse(r); return j && !Array.isArray(j) && (j.state || j.data) ? (j.state ?? j.data) : j; } catch { return null; } };
        const core = {}; for (const c of ['bookings', 'staff', 'clients', 'businesses', 'services']) core[c] = read('bp-mock-db:core:' + c) ?? [];
        const areas = {}; for (const a of ['online', 'client', 'journal']) areas[a] = read('bp-mock-db:area:' + a) ?? {};
        return { core, areas };
      });
    },
    /** Правка сохранённой коллекции/среза: body — тело функции (db, arg), db = { core, areas } как в db() */
    async patch(body, arg) {
      await page.waitForTimeout(900);
      await page.evaluate(({ body, arg }) => {
        const keys = {};
        const read = (k) => { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; };
        const core = {}; for (const c of ['bookings', 'staff', 'clients']) { keys['core.' + c] = 'bp-mock-db:core:' + c; core[c] = read(keys['core.' + c]); }
        const areas = {}; for (const a of ['online', 'client']) { keys['areas.' + a] = 'bp-mock-db:area:' + a; areas[a] = read(keys['areas.' + a]); }
        const db = { core, areas };
        new Function('db', 'arg', body)(db, arg);
        for (const c of Object.keys(core)) if (core[c]) localStorage.setItem(keys['core.' + c], JSON.stringify(core[c]));
        for (const a of Object.keys(areas)) if (areas[a]) localStorage.setItem(keys['areas.' + a], JSON.stringify(areas[a]));
      }, { body, arg });
      await page.evaluate(() => { window.onbeforeunload = null; });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await h.settle(1500);
    },
    async end() { await ctx.close(); if (!process.env.KEEP) await closeShared(); },
  };
  return h;
}
export const log = (...a) => console.log(...a);

/** Запись клиентом через /b/<slug>/book: услуга+мастер из адреса → день → первое окно → детали → «Записаться» */
export async function book(h, { slug, s, m, date, name = 'Тест Онлайн', phone = '91234567', full = false, shotPrefix, slotIndex = 0 }) {
  const p = h.page;
  if (!p.url().startsWith(BASE)) await h.go(`/b/${slug}`, 'guest');
  const before = new Set(((await h.db())?.core?.bookings ?? []).map((b) => b.id));
  await h.go(`/b/${slug}/book?s=${s}&m=${m}&step=time${date ? `&d=${date}` : ''}`, 'guest');
  const slotBtns = p.getByRole('button', { name: /^\s*\d{1,2}:\d{2}\s*$/ });
  await slotBtns.first().waitFor({ timeout: 60000 }).catch(() => {});
  const n = await slotBtns.count();
  if (!n) throw new Error('нет окон: ' + (await h.text()).slice(0, 400));
  const picked = (await slotBtns.nth(Math.min(slotIndex, n - 1)).innerText()).trim();
  await slotBtns.nth(Math.min(slotIndex, n - 1)).click();
  await h.settle(500);
  const cont = p.getByRole('button', { name: /^Продолжить/ });
  if (await cont.count() && await cont.first().isVisible()) { await cont.first().click(); await h.settle(500); }
  if (shotPrefix) await h.shot(shotPrefix + '-details');
  await p.getByPlaceholder('Введите имя').fill(name);
  const tel = p.locator('input[type="tel"]').first();
  await tel.click(); await tel.fill(phone); await p.waitForTimeout(300);
  const send = p.getByRole('button', { name: 'Получить код' });
  if (await send.count()) { await send.click(); await h.settle(1200); }
  await h.settle(600);
  const cb = p.getByText('Согласен на обработку персональных данных');
  const box = p.getByRole('checkbox', { name: /Согласен на обработку/ });
  for (let i = 0; i < 3 && (await cb.count()); i++) {
    if ((await box.count()) && (await box.first().isChecked().catch(() => false))) break;
    await cb.first().click(); await p.waitForTimeout(400);
  }
  if (full) { const f = p.getByText(/^Всю сумму сразу/); if (await f.count()) await f.first().click(); else console.log('!! нет выбора «Всю сумму сразу»'); }
  const detailsText = await h.text();
  if (shotPrefix) await h.shot(shotPrefix + '-details-filled', true);
  await p.getByRole('button', { name: /^Записаться/ }).last().click();
  await p.waitForURL(/\/booking\//, { timeout: 90000 }).catch(() => {});
  await h.settle(800);
  const url = p.url();
  const db = await h.db();
  const id = (url.match(/\/booking\/([^?]+)/) || [])[1];
  const booking = db.core.bookings.find((b) => b.id === id);
  const created = booking ? [booking, ...db.core.bookings.filter((b) => b.id !== id && !before.has(b.id) && before.size)] : [];
  return { url, picked, created, detailsText, db, id };
}
