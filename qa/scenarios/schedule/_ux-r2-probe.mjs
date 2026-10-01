import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'ru-RU', timezoneId:'Asia/Yerevan' });
const p = await ctx.newPage();
await p.goto('http://localhost:3710/biz/schedule?demo=owner&sphere=nails&lang=ru&theme=light', { timeout: 180000 });
await p.locator('h1').first().waitFor({ timeout: 120000 });
await p.waitForTimeout(3000);
const r = await p.evaluate(() => {
  const out = { sw: document.documentElement.scrollWidth, iw: innerWidth, vv: visualViewport.width };
  const wide = [];
  for (const el of document.querySelectorAll('body *')) { const b = el.getBoundingClientRect(); if (b.right > innerWidth + 2 && getComputedStyle(el).position !== 'fixed') wide.push(el.tagName + '.' + String(el.className).slice(0,80) + ' r=' + Math.round(b.right)); }
  out.wide = wide.slice(0, 12);
  const th = document.querySelector('table th'); out.nameCol = th?.getBoundingClientRect().width;
  const fs = [...document.querySelectorAll('table td span.text-xs, table th')].map(e=>getComputedStyle(e).fontSize); out.fs=[...new Set(fs)];
  return out;
});
console.log(JSON.stringify(r, null, 1));
await p.locator('table tbody td button').nth(2).click();
await p.waitForTimeout(2000);
console.log(JSON.stringify(await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, vv: visualViewport.width, scale: visualViewport.scale, dlg: document.querySelector('[role=dialog]')?.getBoundingClientRect() }))));
await b.close();
