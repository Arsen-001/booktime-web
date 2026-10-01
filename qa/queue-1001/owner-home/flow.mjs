// Сценарий: поставить план с главной → прогресс; открыть «Пора позвать» и «Кто не записался».
// node flow.mjs <mock|api> <ru|en> <desktop|phone>
import { chromium } from 'playwright';
import fs from 'node:fs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const DIR = '/Users/arsen/WebstormProjects/booking-platform/qa/queue-1001/owner-home/shots';
const [mode = 'mock', lang = 'ru', device = 'desktop'] = process.argv.slice(2);
const vp = device === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const r = {};
try {
  const ctx = await browser.newContext({ viewport: vp });
  const cookies = [{ name: 'bt_data', value: mode, domain: 'localhost', path: '/' }, { name: 'lang', value: lang, domain: 'localhost', path: '/' }];
  if (mode === 'api') cookies.push(...JSON.parse(fs.readFileSync(new URL('./sessions.json', import.meta.url))).owner);
  await ctx.addCookies(cookies);
  if (process.env.API_PORT) await ctx.route('http://localhost:4010/**', (route) => route.continue({ url: route.request().url().replace(':4010', `:${process.env.API_PORT}`) }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('response', (x) => { if (x.status() >= 400 && !x.url().includes('_next')) errors.push(`HTTP ${x.status()} ${x.url().slice(0, 140)}`); });
  const q = mode === 'mock' ? `?demo=owner&empty=0&lang=${lang}&data=mock` : `?lang=${lang}&data=api`;
  await page.goto(`http://localhost:3710/biz${q}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  const planBtn = page.getByRole('button', { name: lang === 'ru' ? /Поставить план|Изменить план/ : /Set a plan|Change plan/ });
  await planBtn.click();
  await page.waitForTimeout(600);
  await page.locator('[role=dialog] input').fill('');
  await page.locator('[role=dialog] input').fill('500000');
  await page.screenshot({ path: `${DIR}/flow-${mode}-${lang}-${device}-plan-modal.png` });
  await page.getByRole('dialog').getByRole('button', { name: lang === 'ru' ? 'Сохранить' : 'Save' }).click();
  await page.waitForTimeout(2000);
  r.planTile = (await page.locator('section[data-f="F-00-195"]').innerText()).replace(/\s+/g, ' ');
  r.progress = await page.locator('section[data-f="F-00-195"] [role=progressbar]').getAttribute('aria-label');
  await page.screenshot({ path: `${DIR}/flow-${mode}-${lang}-${device}-plan-set.png`, fullPage: true });
  await page.getByRole('button', { name: lang === 'ru' ? 'Позвать' : 'Invite', exact: true }).click();
  await page.waitForTimeout(900);
  r.dueSheet = (await page.getByRole('dialog').innerText()).replace(/\s+/g, ' ').slice(0, 400);
  await page.screenshot({ path: `${DIR}/flow-${mode}-${lang}-${device}-due-sheet.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: lang === 'ru' ? 'Не записались' : 'Not rebooked' }).click();
  await page.waitForTimeout(900);
  r.rebookSheet = (await page.getByRole('dialog').innerText()).replace(/\s+/g, ' ').slice(0, 300);
  await page.screenshot({ path: `${DIR}/flow-${mode}-${lang}-${device}-rebook-sheet.png` });
  await page.keyboard.press('Escape');
  r.errors = [...new Set(errors)];
} catch (e) {
  r.ERROR = String(e).slice(0, 500);
} finally {
  await browser.close();
  release();
}
console.log(JSON.stringify(r, null, 1));
