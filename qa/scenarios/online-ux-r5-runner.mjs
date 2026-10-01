// Сценарии ревьюера online ux-r5 со снимками ВСЕЙ страницы (measure.mjs в сценариях снимает только видимую область).
//   node qa/scenarios/online-ux-r5-runner.mjs qa/scenarios/online-ux-r5-flow.json qa/shots/online-ux-r5-flow
// Формат: [{ name, route, persona, device: phone|desktop, query?, steps: [{click}|{fill,value}|{wait}|{press}|{shot, full?}] }]
import { chromium } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const [file, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const jobs = JSON.parse(fs.readFileSync(file, 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
const b = await chromium.launch();
for (const j of jobs) {
  const ctx = await b.newContext({ ...DEV[j.device], locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const p = await ctx.newPage();
  const q = `demo=${j.persona}&sphere=nails&lang=ru&theme=light${j.query ? '&' + j.query : ''}`;
  const url = `http://localhost:3710${j.route}${j.route.includes('?') ? '&' : '?'}${q}`;
  await p.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await p.addStyleTag({ content: '[data-demo-fab]{display:none!important}' }).catch(() => {});
  for (const [i, s] of j.steps.entries()) {
    try {
      if (s.click) { await p.locator(s.click).first().click({ timeout: 10000 }); await p.waitForTimeout(400); }
      else if (s.fill) await p.locator(s.fill).first().fill(s.value, { timeout: 10000 });
      else if (s.wait) await p.waitForTimeout(s.wait);
      else if (s.press) await p.keyboard.press(s.press);
      else if (s.shot) { await p.screenshot({ path: path.join(out, `${j.name}__${s.shot}.png`), fullPage: !!s.full }); console.log('shot', j.name, s.shot); }
    } catch (e) { console.log('FAIL', j.name, i, JSON.stringify(s), String(e.message).split('\n')[0]); await p.screenshot({ path: path.join(out, `${j.name}__fail-${i}.png`) }); break; }
  }
  await ctx.close();
}
await b.close();
