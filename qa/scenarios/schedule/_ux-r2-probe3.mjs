import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'ru-RU', timezoneId:'Asia/Yerevan' });
const p = await ctx.newPage();
await p.goto('http://localhost:3710/biz/schedule?demo=owner&sphere=nails&lang=ru&theme=light', { timeout: 180000 });
await p.locator('table').first().waitFor({ timeout: 120000 });
await p.waitForTimeout(2000);
console.log(JSON.stringify(await p.evaluate(() => {
  const out = [];
  const s = [...document.querySelectorAll('svg')].find((x) => x.getBoundingClientRect().left > 600 && !x.closest('.overflow-x-auto'));
  let el = s;
  while (el && el !== document.body) {
    const cls = el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className;
    out.push(`${el.tagName}.${String(cls).slice(0, 110)} pos=${getComputedStyle(el).position} aria=${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('data-demo-fab') !== null ? 'FAB' : ''}`);
    el = el.parentElement;
  }
  return out;
}), null, 1));
await b.close();
