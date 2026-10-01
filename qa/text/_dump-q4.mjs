// Снимает видимый текст экранов (ru, en) для редактора текстов (q4). Только чтение.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
const OUT = process.argv[2];
const BASE = 'http://localhost:3710';
const r = await (await fetch(BASE + '/dev/routes')).json();
const areas = (process.argv[3]||'loyalty,finance,client,journal,schedule,online,notify,clients').split(',');
const jobs = [];
for (const a of areas) for (const route of r.areas[a] || []) {
  if (route.startsWith('/dev/')) continue;
  const persona = route.startsWith('/platform') ? 'platform' : (route.startsWith('/biz') ? 'owner' : 'client');
  for (const lang of ['ru','en']) jobs.push({ a, route, persona, lang });
}
const fileOf = (j) => path.join(OUT, `${j.a}__${j.route.replace(/[^a-z0-9]+/gi,'-')}__${j.lang}.txt`);
const todo = jobs.filter((j) => { try { return /\n\nERROR /.test(fs.readFileSync(fileOf(j), 'utf8')); } catch { return true; } });
jobs.length = 0; jobs.push(...todo);
console.log('todo', jobs.length);
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
let i = 0;
async function worker() {
  while (i < jobs.length) {
    const j = jobs[i++];
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: j.lang === 'en' ? 'en-US' : 'ru-RU', timezoneId: 'Asia/Yerevan' });
    const page = await ctx.newPage();
    const url = `${BASE}${j.route}?demo=${j.persona}&empty=0&sphere=nails&lang=${j.lang}&theme=light`;
    let text = '';
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForTimeout(1500);
      text = await page.evaluate(() => { document.querySelectorAll('[data-demo-fab]').forEach(e => e.remove()); return document.body.innerText; });
    } catch (e) { text = 'ERROR ' + e.message; }
    fs.writeFileSync(fileOf(j), url + '\n\n' + text);
    await ctx.close();
  }
}
await Promise.all([worker(), worker()]);
await browser.close(); release();
console.log('done', jobs.length);
