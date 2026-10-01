import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'ru-RU', timezoneId:'Asia/Yerevan' });
const p = await ctx.newPage();
for (const route of ['/biz/schedule', '/biz/schedule/calendar', '/biz/schedule/templates', '/biz/clients']) {
  await p.goto('http://localhost:3710' + route + '?demo=' + (route.includes('calendar') ? 'master' : 'owner') + '&sphere=nails&lang=ru&theme=light', { timeout: 180000 });
  await p.locator('h1').first().waitFor({ timeout: 120000 }).catch(()=>{});
  await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const res = [];
    for (const el of document.querySelectorAll('body *')) {
      const w = el.getBoundingClientRect().width;
      if (w > 400 && !el.closest('.overflow-x-auto') ) res.push(el.tagName + '.' + String(el.className).slice(0, 90) + ' w=' + Math.round(w));
    }
    return { iw: innerWidth, sw: document.documentElement.scrollWidth, items: res.slice(-6) };
  });
  console.log(route, JSON.stringify(r, null, 1));
}
await b.close();
