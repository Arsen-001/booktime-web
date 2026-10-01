// Рабочий день №8/10/12 в режиме mock: горячие клавиши, стойка, лента, подсветка чужой правки.
// node qa/queue-1001/workday-8-10-12/mock.mjs [step]
import { chromium } from 'playwright';
import path from 'node:path';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname);
const B = 'http://localhost:3710';
const step = process.argv[2] ?? 'all';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const out = {};
const errors = [];
const cookies = (persona, lang) => [
  { name: 'demo_persona', value: persona, domain: 'localhost', path: '/' },
  { name: 'demo_sphere', value: 'nails', domain: 'localhost', path: '/' },
  { name: 'lang', value: lang, domain: 'localhost', path: '/' },
  { name: 'bt_data', value: 'mock', domain: 'localhost', path: '/' },
];
async function newPage(persona, lang, width, ctx) {
  ctx ??= await browser.newContext({ viewport: { width, height: width < 500 ? 844 : width < 1000 ? 1112 : 900 }, locale: lang === 'en' ? 'en-US' : 'ru-RU' });
  await ctx.addCookies(cookies(persona, lang));
  const page = await ctx.newPage();
  // Время «середина рабочего дня», чтобы на стойке были все группы (сид мока — записи 10:00–20:00 сегодня)
  if (process.env.AT) await page.clock.install({ time: new Date(process.env.AT) });
  page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console ${m.text().slice(0, 200)}`); });
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: `${DIR}/shots/${name}.png` });
const settle = async (page, ms = 1200) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(ms); };
const dateText = (page) => page.locator('h1.sr-only').evaluate(() => (document.querySelector('[data-f*="F-01-009"]')?.innerText ?? '').split('\n').slice(0, 3).join(' '));
const press = (page, code, key) => page.evaluate(([code, key]) => document.body.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true })), [code, key]);
try {
  if (step === 'all' || step === 'keys') {
    const { ctx, page } = await newPage('owner', 'ru', 1440);
    await page.goto(`${B}/biz/journal`); await settle(page, 2500);
    const d0 = await dateText(page);
    // Русская раскладка: физическая T печатает «е»
    await press(page, 'KeyT', 'е'); await press(page, 'ArrowRight', 'ArrowRight'); await settle(page, 500);
    const d1 = await dateText(page);
    await press(page, 'ArrowLeft', 'ArrowLeft'); await settle(page, 500);
    const d2 = await dateText(page);
    // 2 — «Обзор», 4 — «Список», 1 — «Колонки»
    await press(page, 'Digit4', '4'); await settle(page, 700);
    out.listView = await page.locator('[data-list-open]').count();
    await press(page, 'Digit1', '1'); await settle(page, 500);
    // ? (Shift + /) на русской раскладке — это «,»
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Slash', key: ',', shiftKey: true, bubbles: true })));
    await settle(page, 600);
    out.helpOpen = await page.getByRole('dialog').innerText().catch(() => 'NO DIALOG');
    await shot(page, 'hotkeys-help-ru-1440');
    await page.keyboard.press('Escape'); await settle(page, 500);
    out.helpClosed = (await page.getByRole('dialog').count()) === 0;
    // N (рус. «т») — новая запись
    await press(page, 'KeyN', 'т'); await settle(page, 1500);
    out.newOpen = page.url();
    await shot(page, 'hotkey-N-new-booking-1440');
    // В окне записи N/T не срабатывают: печатаем в поле
    await page.keyboard.press('Escape'); await settle(page, 1200);
    await shot(page, 'hotkey-N-after-esc-1440');
    out.afterEscUrl = page.url();
    if (page.url().includes('new=1')) { await page.keyboard.press('Escape'); await settle(page, 1200); out.afterEsc2Url = page.url(); }
    // «/» — поиск (рус. «.»)
    await press(page, 'Slash', '.'); await settle(page, 800);
    out.searchOpen = await page.getByRole('dialog').count();
    const input = page.getByRole('dialog').locator('input').first();
    if (await input.count()) { await input.focus(); await page.keyboard.press('n'); await page.keyboard.press('t'); }
    await settle(page, 400);
    out.typingNoNew = !page.url().includes('new=1');
    await page.keyboard.press('Escape'); await settle(page, 700);
    // F — «Найти окно»
    await press(page, 'KeyF', 'а'); await settle(page, 800);
    out.findSlotOpen = await page.locator('[role="dialog"], [data-popover]').count();
    await shot(page, 'hotkey-F-find-slot-1440');
    out.dates = { d0, d1, d2 };
    await ctx.close();
  }
  if (step === 'all' || step === 'desk') {
    for (const [lang, width] of [['ru', 390], ['ru', 834], ['ru', 1024], ['ru', 1440], ['en', 834], ['en', 390]]) {
      const { ctx, page } = await newPage('admin', lang, width);
      await page.goto(`${B}/biz/journal/desk`); await settle(page, 2500);
      await shot(page, `desk-${lang}-${width}`);
      if (width === 834 && lang === 'ru') {
        const before = await page.locator('[data-desk-action="arrive"]').count();
        await page.locator('[data-desk-action="arrive"]').first().click(); await settle(page, 1200);
        out.deskArrive = { before, after: await page.locator('[data-desk-action="arrive"]').count(), toast: await page.locator('[role="status"], [data-sonner-toast], [role="alert"]').allInnerTexts().catch(() => []) };
        await shot(page, `desk-arrived-${lang}-${width}`);
        await page.screenshot({ path: `${DIR}/shots/desk-full-${lang}-${width}.png`, fullPage: true });
      }
      await ctx.close();
    }
    const { ctx, page } = await newPage('master', 'ru', 834);
    await page.goto(`${B}/biz/journal/desk`); await settle(page, 2500);
    await shot(page, 'desk-master-ru-834');
    out.masterDeskText = (await page.locator('main').innerText()).slice(0, 400);
    await ctx.close();
  }
  if (step === 'all' || step === 'feed') {
    for (const [lang, width] of [['ru', 1440], ['ru', 390], ['en', 1440], ['ru', 834]]) {
      const { ctx, page } = await newPage('owner', lang, width);
      await page.goto(`${B}/biz/journal`); await settle(page, 2500);
      // «⋯ Ещё» → «Лента изменений»
      if (width < 768) await page.getByRole('button', { name: lang === 'en' ? /more/i : /ещё/i }).last().click();
      else await page.locator('[data-f="F-01-010 F-01-011 F-01-016"]').first().click();
      await settle(page, 700);
      await page.getByRole('button', { name: lang === 'en' ? 'Change log' : 'Лента изменений' }).click();
      await settle(page, 1200);
      await shot(page, `feed-${lang}-${width}`);
      await ctx.close();
    }
  }
  if (step === 'all' || step === 'highlight') {
    // Две вкладки одного браузера (база мока общая через localStorage): A — владелец смотрит «Список»,
    // B — администратор отмечает приход. В A запись должна мигнуть.
    const { ctx, page: a } = await newPage('owner', 'ru', 1440);
    await a.goto(`${B}/biz/journal`); await settle(a, 2500);
    await a.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit4', key: '4', bubbles: true })));
    await settle(a, 1500);
    await ctx.addCookies(cookies('admin', 'ru'));
    const b = await ctx.newPage();
    await b.goto(`${B}/biz/journal/desk`); await settle(b, 2500);
    const target = await b.locator('li[data-booking]:has([data-desk-action="arrive"])').first().getAttribute('data-booking');
    await b.locator(`li[data-booking="${target}"] [data-desk-action="arrive"]`).click(); await settle(b, 1500);
    await a.bringToFront();
    await a.waitForFunction(() => Boolean(document.querySelector('style[data-journal-changes]')?.textContent), null, { timeout: 25000 }).catch(() => {});
    const el = a.locator(`[data-booking="${target}"]:visible`).first();
    if (await el.count()) { await el.scrollIntoViewIfNeeded(); await a.waitForTimeout(500); await shot(a, 'highlight-foreign-change-ru-1440'); }
    out.highlightCss = await a.evaluate(() => document.querySelector('style[data-journal-changes]')?.textContent?.slice(0, 160) ?? '');
    out.highlightTarget = target;
    await ctx.addCookies(cookies('owner', 'ru'));
    // Лента в A: строка от администратора
    await a.locator('[data-f="F-01-010 F-01-011 F-01-016"]').first().click(); await settle(a, 600);
    await a.getByRole('button', { name: 'Лента изменений' }).click(); await settle(a, 1200);
    out.feedTop = (await a.getByRole('dialog').innerText()).slice(0, 300);
    await shot(a, 'feed-after-arrival-ru-1440');
    await ctx.close();
  }
} catch (e) {
  out.ERROR = String(e).slice(0, 800);
} finally {
  await browser.close();
  release();
}
console.log(JSON.stringify({ out, errors: [...new Set(errors)].slice(0, 30) }, null, 1));
