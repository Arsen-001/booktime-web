// Проверяющий пропусков journal, круг 1: два точечных вопроса без правки кода.
// 1) F-01-027/F-01-078: смена статуса в карточке «Статус и оплата» перекрашивает блок без перезагрузки?
// 2) F-01-152: «Список услуг» достижим на телефоне (через шторку календаря)?
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const out = {};
try {
  // ── 1. десктоп
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light&date=2026-09-28`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const blocks = page.locator('[data-testid="booking-block"]');
  out.blocks = await blocks.count();
  // ищем блок, у которого тело не «success» (ещё не пришёл)
  let idx = -1;
  for (let i = 0; i < out.blocks; i++) {
    const cls = await blocks.nth(i).locator('span').first().getAttribute('class');
    if (cls && cls.includes('bg-accent')) { idx = i; break; }
  }
  out.pickedIdx = idx;
  if (idx >= 0) {
    const wrapper = blocks.nth(idx).locator('xpath=..');
    const before = await blocks.nth(idx).innerHTML();
    out.headBefore = await blocks.nth(idx).locator('span').first().getAttribute('class');
    await wrapper.getByRole('button', { name: 'Статус и оплата' }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'qa/shots/journal/gaps1-card.png' });
    const arrived = page.getByRole('button', { name: /пришел|пришёл/i }).first();
    out.arrivedBtn = await arrived.count();
    if (out.arrivedBtn) {
      await arrived.click();
      await page.waitForTimeout(2000);
      out.toast = await page.getByText('Статус изменён').count();
      const after = await blocks.nth(idx).innerHTML().catch(() => '');
      out.headAfter = await blocks.nth(idx).locator('span').first().getAttribute('class').catch(() => null);
      out.blockChangedWithoutReload = before !== after;
      await page.screenshot({ path: 'qa/shots/journal/gaps1-after-status.png' });
    }
  }
  out.pageErrorsDesktop = errs;
  await ctx.close();

  // ── 2. телефон
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await p2.waitForTimeout(1500);
  await p2.getByRole('button', { name: 'Календарь и быстрые действия' }).click();
  await p2.waitForTimeout(800);
  const tile = p2.getByRole('button', { name: 'Список услуг' });
  out.phoneServiceTile = await tile.count();
  if (out.phoneServiceTile) {
    await tile.first().scrollIntoViewIfNeeded();
    await tile.first().click();
    await p2.waitForTimeout(1000);
    out.phoneServiceListVisible = await p2.locator('[data-f="F-01-152"]').filter({ has: p2.locator('*') }).count();
    await p2.screenshot({ path: 'qa/shots/journal/gaps1-phone-services.png' });
  }
  await ctx2.close();
} catch (e) {
  out.error = String(e);
} finally {
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  release();
}
