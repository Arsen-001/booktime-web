// F-03-106 «Готово, когда»: на одном экране виден ОДИН промоблок. Сид уже даёт 2 блока на 'menu'
// (один approved, один pending) — одобряем второй напрямую в localStorage (владелец не может сам
// одобрить — модерации в UI online нет, см. qa/requests/online.md), затем считаем карточки на /b.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3710/biz/online/page?persona=owner&lang=ru&sphere=nails');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  const result = await page.evaluate(() => {
    const raw = localStorage.getItem('bp-mock-db');
    if (!raw) return { ok: false, reason: 'no-db' };
    const parsed = JSON.parse(raw);
    const online = parsed.state.areas.online;
    let changed = 0;
    for (const bizId of Object.keys(online.promoBlocks || {})) {
      for (const block of online.promoBlocks[bizId]) {
        if (block.status === 'pending' && block.screens?.includes('menu')) {
          block.status = 'approved';
          changed++;
        }
      }
    }
    localStorage.setItem('bp-mock-db', JSON.stringify(parsed));
    return { ok: true, changed };
  });
  console.log('approve result', result);

  await page.goto('http://localhost:3710/b/nuri-nail-studio?persona=client&lang=ru');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const count = await page.locator('[data-f="F-03-106"]').count();
  const titles = await page.locator('[data-f="F-03-106"] p.font-medium').allTextContents();
  console.log('promo cards on /b:', count, titles);
  await page.screenshot({ path: 'qa/shots/online-g2-2/promo-multi-after.png', fullPage: true });
  await ctx.close();
} finally {
  await browser.close();
  release();
}
