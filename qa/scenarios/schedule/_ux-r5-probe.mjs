// ux-r5: кто расширяет страницу на телефоне (/biz/schedule) и где открывается панель
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
const page = await ctx.newPage();
await page.goto('http://localhost:3710/biz/schedule?demo=owner&sphere=nails&lang=ru&theme=light', { waitUntil: 'load', timeout: 180000 });
await page.locator('table').first().waitFor({ timeout: 120000 });
await page.waitForTimeout(2000);
const r = await page.evaluate(() => {
  const out = { iw: innerWidth, vw: visualViewport.width, sw: document.documentElement.scrollWidth, wide: [] };
  for (const el of document.querySelectorAll('body *')) {
    const rc = el.getBoundingClientRect();
    if (rc.right > 400 && rc.width > 0) {
      let p = el.parentElement, clipped = false;
      while (p) { const s = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(s.overflowX)) { clipped = true; break; } p = p.parentElement; }
      if (!clipped) out.wide.push(`${el.tagName}.${String(el.className).slice(0, 60)} right=${Math.round(rc.right)} pos=${getComputedStyle(el).position}`);
    }
  }
  out.wide = out.wide.slice(0, 12);
  return out;
});
console.log(JSON.stringify(r, null, 1));
const srOnly = await page.evaluate(() => { const s = document.querySelector('table .sr-only'); if (!s) return 'нет sr-only'; const rc = s.getBoundingClientRect(); let p = s.parentElement; while (p && getComputedStyle(p).position === 'static') p = p.parentElement; return { left: rc.left, containing: p ? p.tagName + '.' + String(p.className).slice(0, 80) : 'viewport' }; });
console.log('sr-only:', JSON.stringify(srOnly));
await page.locator('table tbody td button').nth(2).click();
await page.waitForTimeout(1500);
const d = await page.evaluate(() => { const el = [...document.querySelectorAll('[role=dialog]')].pop(); if (!el) return 'нет dialog'; const rc = el.getBoundingClientRect(); return { x: rc.x, y: rc.y, w: rc.width, h: rc.height, iw: innerWidth, ih: innerHeight }; });
console.log('panel:', JSON.stringify(d));
await b.close();
