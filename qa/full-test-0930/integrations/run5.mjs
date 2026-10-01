import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/integrations';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  for (const lang of ['ru', 'en']) {
    const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await p.goto(`http://localhost:3710/biz/integrations/api?tab=webhooks&demo=owner&lang=${lang}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForTimeout(3500);
    const r = await p.evaluate(() => { const l = document.querySelector('[role=tablist]'); const m = document.querySelector('[data-f~="F-13-051"]'); return { ov: l ? l.scrollWidth - l.clientWidth : -1, w: m ? m.getBoundingClientRect().width : -1, cls: m ? m.className : "" }; });
    console.log(lang, JSON.stringify(r));
    await p.screenshot({ path: `${OUT}/fix-api-tabs-${lang}.png` });
  }
} finally { await browser.close(); release(); }
