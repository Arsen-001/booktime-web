// Чужая запись по ссылке: id берём кликом владельца по карточке Мариам, потом открываем её у мастера / админа / владельца
import { chromium } from '/Users/arsen/WebstormProjects/booking-platform/node_modules/playwright/index.mjs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-perms';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const mk = async (persona, device) => {
  const phone = device === 'phone';
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/biz/journal?date=2026-09-30&demo=${persona}&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(2500);
  return p;
};
try {
  const o = await mk('owner', 'desktop');
  await o.locator('[data-testid=booking-block]', { hasText: 'Лиана М.' }).first().click();
  await o.waitForTimeout(2500);
  const id = new URL(o.url()).searchParams.get('booking');
  console.log('FOREIGN', id);
  for (const persona of ['master', 'owner', 'admin']) for (const device of ['phone', 'desktop']) {
    const p = await mk(persona, device);
    await p.goto(`${BASE}/biz/journal?booking=${id}&date=2026-09-30`, { waitUntil: 'networkidle' }).catch(() => {});
    await p.locator('[role=dialog]').first().waitFor({ timeout: 12000 }).catch(() => {});
    await p.waitForTimeout(3000);
    await p.addStyleTag({ content: '[data-demo-fab]{display:none!important}' }).catch(() => {});
    const r = await p.evaluate(() => {
      const d = [...document.querySelectorAll('[role=dialog]')].filter((x) => x.getClientRects().length).pop();
      if (!d) return { none: true };
      const b = [...d.querySelectorAll('button')].filter((e) => e.getClientRects().length).map((e) => (e.getAttribute('aria-label') || e.innerText).trim().replace(/\s+/g, ' ').slice(0, 24) + (e.disabled ? '[off]' : ''));
      return { lock: /Это запись другого мастера/.test(d.innerText), client: /Лиана/.test(d.innerText), phone: /\+374/.test(d.innerText), text: d.innerText.slice(0, 200).replace(/\n+/g, ' / '), buttons: b.join(' | ') };
    });
    console.log(`${persona}-${device}`, JSON.stringify(r).slice(0, 900));
    await p.screenshot({ path: `${OUT}/${persona}-${device}-A-foreign.png` });
    await p.context().close();
  }
} finally { await browser.close(); release(); }
