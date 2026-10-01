// Снимки «рабочего дня» журнала (пункты 5–7): панель, утренняя сводка, незакрытые визиты, итоги дня.
//   node qa/queue-1001/workday-shots.mjs [mock|api] [ru,en] [390,1440] [--act]
// api: сессии из sessions.json (вход кодом разработки), запросы /journal/workday/* можно перенаправить на API_ALT.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';

const [mode = 'mock', langsArg = 'ru,en', widthsArg = '390,1440'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ACT = process.argv.includes('--act');
const ROLE = process.env.ROLE ?? 'owner';
const BASE = 'http://localhost:3710';
const OUT = path.resolve('qa/shots/journal-workday');
const ALT = process.env.API_ALT; // например http://localhost:4011 — сервер с новыми маршрутами
fs.mkdirSync(OUT, { recursive: true });

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = [];
try {
  for (const lang of langsArg.split(',')) {
    for (const w of widthsArg.split(',').map(Number)) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, deviceScaleFactor: 1 });
      if (mode === 'api') await ctx.addCookies(JSON.parse(fs.readFileSync(process.env.SESSIONS, 'utf8'))[ROLE].map((c) => ({ ...c, domain: 'localhost' })));
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => {
        if (m.type() === 'error' || /i18n:missing|no-en/.test(m.text())) errors.push(m.text().slice(0, 300));
      });
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
      if (ALT) await page.route('http://localhost:4010/v1/biz/*/journal/workday/**', (route) => route.continue({ url: route.request().url().replace('http://localhost:4010', ALT) }));
      const q = mode === 'api' ? `?data=api&lang=${lang}` : `?data=mock&demo=${ROLE}&sphere=nails&lang=${lang}`;
      await page.goto(`${BASE}/biz/journal${q}`, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForTimeout(2500);
      const tag = `${mode}-${ROLE}-${lang}-${w}`;
      const shot = async (name) => page.screenshot({ path: path.join(OUT, `${name}__${tag}.png`) });
      if (w >= 1440) await shot('panel');
      const open = async (kind) => {
        await page.evaluate((k) => window.dispatchEvent(new CustomEvent('journal:workday', { detail: { kind: k } })), kind);
        await page.waitForTimeout(1800);
      };
      const close = async () => {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
      };
      if (ROLE !== 'master') {
        await open('morning');
        const first = page.locator('[role="dialog"] button[aria-expanded]').first();
        if (await first.count()) await first.click();
        await page.waitForTimeout(500);
        await shot('morning');
        await close();
      }
      await open('unclosed');
      await shot('unclosed');
      if (ACT) {
        const dlg = page.locator('[role="dialog"]');
        const arrive = dlg.getByRole('button', { name: lang === 'ru' ? 'Пришёл' : 'Came', exact: true }).first();
        if (await arrive.count()) {
          await arrive.click();
          await page.waitForTimeout(1500);
          log.push(`${tag}: «Пришёл» нажато`);
        }
        const payBtn = dlg.locator('button', { hasText: lang === 'ru' ? 'Оплатить' : 'Pay' }).first();
        if (await payBtn.count()) {
          const label = await payBtn.innerText();
          await payBtn.click();
          await page.waitForTimeout(2000);
          log.push(`${tag}: оплата «${label}»`);
        }
        await shot('unclosed-after');
      }
      await close();
      if (ROLE !== 'master') {
        await open('dayClose');
        await shot('dayclose');
        const sheet = page.locator('[role="dialog"]').last();
        await sheet.evaluate((el) => {
          const sc = [...el.querySelectorAll('*')].find((n) => n.scrollHeight > n.clientHeight + 20 && getComputedStyle(n).overflowY !== 'visible');
          if (sc) sc.scrollTop = sc.scrollHeight;
        });
        await page.waitForTimeout(400);
        await shot('dayclose-bottom');
        await close();
      }
      log.push(`${tag}: ошибок консоли ${errors.length}${errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''}`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  release();
}
console.log(log.join('\n'));
