// Секундомер новичка k4 (копия probe.mjs + ограничитель браузеров pw-slots): прогон одной задачи по шагам в живом браузере.
//
//   node qa/speed/probe.mjs <сессия> '<json-шаги>'
//
// Сессия — папка профиля браузера (localStorage живёт между вызовами, как у одного человека).
// Шаги: {go, persona, device} · {click} · {fill, value} · {press} · {shot} · {dump} · {text} · {wait} · {eval}
// Считает нажатия (click/press) и ввод (fill: символы), печатает, что видно на экране.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = 'http://localhost:3710';
const SHOTS = path.join(ROOT, 'qa/shots/speed');
const VIEW = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };

const [session, raw] = process.argv.slice(2);
const steps = JSON.parse(raw ?? '[]');
const dir = path.join(process.env.TMPDIR ?? '/tmp', 'speed-sessions', session);
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

const stateFile = path.join(dir, '_device.json');
let device = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')).device : 'phone';

const release = await acquireBrowserSlot();
const ctx = await chromium.launchPersistentContext(dir, {
  headless: true,
  viewport: VIEW[device],
  locale: 'ru-RU',
  timezoneId: 'Asia/Yerevan',
  geolocation: { latitude: 40.1792, longitude: 44.5086 },
  permissions: ['geolocation'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
page.on('dialog', (d) => d.dismiss().catch(() => {}));

async function settle(extra = 250) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page
    .waitForFunction(
      () =>
        ![...document.querySelectorAll('[aria-busy="true"], [data-skeleton]')].some((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }),
      null,
      { timeout: 6000 },
    )
    .catch(() => {});
  await page.waitForTimeout(extra);
}

async function dump(limit = 80) {
  const items = await page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.bottom > 0 && r.top < innerHeight * 3;
    };
    const dlg = [...document.querySelectorAll('[role=dialog], [role=alertdialog]')].filter(vis).pop();
    const root = dlg ?? document;
    const els = [...root.querySelectorAll('a, button, [role=button], [role=tab], [role=option], [role=menuitem], [role=switch], [role=checkbox], input, select, textarea, [role=combobox]')].filter(vis);
    return els.map((el) => {
      const r = el.getBoundingClientRect();
      const label = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.getAttribute('name') || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      return `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[${el.getAttribute('role')}]` : ''} «${label}» ${Math.round(r.width)}×${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)}${el.disabled ? ' (disabled)' : ''}`;
    });
  });
  console.log(`  · элементов: ${items.length}`);
  for (const i of items.slice(0, limit)) console.log('   ', i);
}

let taps = 0;
let chars = 0;
const t0 = Date.now();
for (const s of steps) {
  const ts = Date.now();
  try {
    if (s.device && s.device !== device) {
      device = s.device;
      await page.setViewportSize(VIEW[device]);
    }
    if (s.go) {
      const sep = s.go.includes('?') ? '&' : '?';
      const q = s.persona ? `${sep}demo=${s.persona}&lang=ru&theme=light&api=normal${s.sphere ? `&sphere=${s.sphere}` : ''}` : '';
      await page.goto(`${BASE}${s.go}${q}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await settle(400);
      console.log(`→ открыл ${page.url().replace(BASE, '')} (${Date.now() - ts} мс)`);
    } else if (s.click) {
      const loc = page.locator(s.click).nth(s.nth ?? 0);
      await loc.waitFor({ state: 'visible', timeout: 5000 });
      const box = await loc.boundingBox();
      await loc.click({ timeout: 5000, force: !!s.force });
      taps++;
      await settle(s.after ?? 250);
      console.log(`● нажал ${s.click}${box ? ` [${Math.round(box.width)}×${Math.round(box.height)}]` : ''} (${Date.now() - ts} мс) → ${page.url().replace(BASE, '')}`);
    } else if (s.fillEval) {
      const v = String(await page.evaluate(s.js));
      const loc = page.locator(s.fillEval).nth(s.nth ?? 0);
      await loc.click();
      await loc.pressSequentially(v, { delay: 30 });
      taps++;
      chars += v.length;
      await settle(200);
      console.log(`✎ ввёл «${v}» в ${s.fillEval}`);
    } else if (s.fill) {
      const loc = page.locator(s.fill).nth(s.nth ?? 0);
      await loc.waitFor({ state: 'visible', timeout: 5000 });
      if (s.type) {
        await loc.click();
        await loc.pressSequentially(s.value, { delay: 30 });
      } else await loc.fill(s.value);
      chars += s.value.length;
      await settle(s.after ?? 200);
      console.log(`✎ ввёл «${s.value}» в ${s.fill}`);
    } else if (s.press) {
      await page.keyboard.press(s.press);
      if (!s.free) taps++;
      await settle(200);
      console.log(`⌨ ${s.press}`);
    } else if (s.tap) {
      await page.mouse.click(s.tap[0], s.tap[1]);
      taps++;
      await settle(s.after ?? 250);
      console.log(`● тап ${s.tap} (${Date.now() - ts} мс) → ${page.url().replace(BASE, '')}`);
    } else if (s.select) {
      await page.locator(s.select).nth(s.nth ?? 0).selectOption(s.option ? { label: s.option } : s.value);
      taps += 2;
      await settle(200);
      console.log(`▾ выбрал «${s.option ?? s.value}» в ${s.select} (2 нажатия)`);
    } else if (s.wait) {
      await page.waitForTimeout(s.wait);
    } else if (s.shot) {
      const f = path.join(SHOTS, `${s.shot}.png`);
      await page.screenshot({ path: f, fullPage: !!s.full });
      console.log(`📷 ${path.relative(ROOT, f)}`);
    } else if (s.dump) {
      await dump(s.limit);
    } else if (s.text) {
      const txt = await page.evaluate((sel) => (document.querySelector(sel) ?? document.body).innerText, typeof s.text === 'string' ? s.text : 'body');
      console.log('  ¶', txt.replace(/\n{2,}/g, '\n').slice(0, s.max ?? 1800).split('\n').join(' | '));
    } else if (s.eval) {
      const r = await page.evaluate(s.eval);
      console.log('  =', JSON.stringify(r)?.slice(0, 1500));
    } else if (s.scroll) {
      await page.locator(s.scroll).first().scrollIntoViewIfNeeded();
      await settle(150);
    }
  } catch (e) {
    console.log(`✗ шаг ${JSON.stringify(s)}: ${String(e.message).split('\n')[0].slice(0, 200)}`);
    const f = path.join(SHOTS, `_fail-${session}.png`);
    await page.screenshot({ path: f }).catch(() => {});
    console.log(`📷 ${path.relative(ROOT, f)}`);
    if (!s.optional) break;
  }
}
fs.writeFileSync(stateFile, JSON.stringify({ device }));
console.log(`Σ нажатий ${taps}, символов ${chars}, прогон ${Date.now() - t0} мс${errs.length ? `, ошибки страницы: ${errs.join(' | ')}` : ''}`);
await ctx.close();
release();
