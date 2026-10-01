// ⭐ «День закрыт» в режиме api: колокольчик владельца с сервера (копия api на ALT, сессия владельца в OWNER_SESSION).
//   OWNER_SESSION=<bt_session> ALT=http://localhost:4032 node qa/queue-1001b/dayclose-api.mjs [ru|en] [390|1440]
import path from 'node:path';
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';

const [lang = 'ru', width = '1440'] = process.argv.slice(2);
const w = Number(width);
const ALT = process.env.ALT ?? 'http://localhost:4032';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = [];
try {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 } });
  await ctx.addCookies([{ name: 'bt_session', value: process.env.OWNER_SESSION, domain: 'localhost', path: '/', httpOnly: true }]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log.push('pageerror ' + String(e).slice(0, 200)));
  await page.route('http://localhost:4010/**', (r) => r.continue({ url: r.request().url().replace('http://localhost:4010', ALT) }));
  await page.goto(`http://localhost:3710/biz/clients?data=api&lang=${lang}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: lang === 'ru' ? 'Уведомления' : 'Notifications' }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.resolve(`qa/queue-1001b/dayclose/api-owner-bell__${lang}-${w}.png`) });
  const row = page.getByText(lang === 'ru' ? /День закрыт/ : /closed the day/).first();
  log.push('строка: ' + (await row.count() ? await row.innerText() : 'нет'));
  await row.click();
  await page.waitForTimeout(4000);
  log.push('адрес: ' + page.url().replace('http://localhost:3710', ''));
  log.push('шторка: ' + ((await page.locator('[role="dialog"]').last().innerText().catch(() => '')) .split('\n').slice(0, 1).join('')));
  await page.screenshot({ path: path.resolve(`qa/queue-1001b/dayclose/api-owner-sheet__${lang}-${w}.png`) });
  await ctx.close();
} finally {
  await browser.close();
  release();
}
console.log(log.join('\n'));
