// «Закрыть день» на кассовой смене: открыть смену в финансах → итоги дня в журнале → пересчёт → «Закрыть день».
//   node qa/queue-1001/workday-shift.mjs [mock|api] [ru|en] [390|1440]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';

const [mode = 'mock', lang = 'ru', width = '1440'] = process.argv.slice(2);
const w = Number(width);
const ROLE = process.env.ROLE ?? 'admin';
const OUT = path.resolve('qa/shots/journal-workday');
const ALT = process.env.API_ALT;
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = [];
try {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 } });
  if (mode === 'api') await ctx.addCookies(JSON.parse(fs.readFileSync(process.env.SESSIONS, 'utf8'))[ROLE]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log.push('pageerror ' + String(e).slice(0, 200)));
  if (ALT) await page.route('http://localhost:4010/v1/biz/*/journal/workday/**', (r) => r.continue({ url: r.request().url().replace('http://localhost:4010', ALT) }));
  const q = mode === 'api' ? `?data=api&lang=${lang}` : `?data=mock&demo=${ROLE}&sphere=nails&lang=${lang}`;
  const tag = `${mode}-${ROLE}-${lang}-${w}`;
  // 1. Смена: открыть, если закрыта
  await page.goto(`http://localhost:3710/biz/finance/shift${q}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  const openBtn = page.getByRole('button', { name: lang === 'ru' ? 'Открыть смену' : 'Open shift', exact: true }).first();
  if (await openBtn.count()) {
    await openBtn.click();
    await page.waitForTimeout(600);
    await page.locator('[role="dialog"] input').first().fill('20000');
    await page.locator('[role="dialog"] button').filter({ hasText: lang === 'ru' ? 'Открыть смену' : 'Open shift' }).last().click();
    await page.waitForTimeout(1500);
    log.push('смена открыта');
  } else log.push('смена уже открыта или кнопки нет');
  // 2. Журнал → итоги дня
  await page.goto(`http://localhost:3710/biz/journal${mode === 'api' ? '' : ''}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('journal:workday', { detail: { kind: 'dayClose' } })));
  await page.waitForTimeout(2000);
  const dlg = page.locator('[role="dialog"]');
  const input = dlg.locator('input').last();
  await input.scrollIntoViewIfNeeded();
  await input.fill('45000');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `shift-count__${tag}.png`) });
  await dlg.getByRole('button', { name: lang === 'ru' ? 'Закрыть день' : 'Close the day' }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, `shift-closed__${tag}.png`) });
  log.push('закрыто: ' + ((await dlg.innerText()).match(/(Смена закрыта[^\n]*|Shift closed[^\n]*)/)?.[0] ?? 'нет строки'));
  await ctx.close();
} finally {
  await browser.close();
  release();
}
console.log(log.join('\n'));
