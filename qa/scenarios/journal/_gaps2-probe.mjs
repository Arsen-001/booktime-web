// Проверяющий пропусков journal, круг 2: точечные вопросы без правки кода.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const out = {};
try {
  // 1. телефон: где начинается сетка, есть ли кнопка режима (F-01-001)
  const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ph.newPage();
  const perr = [];
  p.on('pageerror', (e) => perr.push(e.message));
  await p.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light&date=2026-09-28`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  const firstBlock = p.locator('[data-testid="booking-block"]').first();
  out.phoneFirstBlockTop = (await firstBlock.count()) ? (await firstBlock.boundingBox())?.y : null;
  out.phoneAdminModeBtn = await p.locator('[data-f="F-01-001"]').count();
  out.phoneH1 = await p.locator('h1').allInnerTexts();
  await p.screenshot({ path: 'qa/shots/journal/gaps2-phone.png' });
  out.phoneErrors = perr;
  await ph.close();

  // 2. десктоп: открыть запись, какие вкладки у окна, что открывает «Оплатить»
  const dc = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await dc.newPage();
  const derr = [];
  d.on('pageerror', (e) => derr.push(e.message));
  await d.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light&date=2026-09-28`, { waitUntil: 'networkidle' });
  await d.waitForTimeout(2000);
  const blocks = d.locator('[data-testid="booking-block"]');
  out.desktopBlocks = await blocks.count();
  // «Новая запись» — меню или сразу окно?
  const nb = d.getByRole('button', { name: /Новая запись/ }).first();
  if (await nb.count()) {
    await nb.click();
    await d.waitForTimeout(800);
    out.newMenuItems = await d.getByRole('menuitem').allInnerTexts();
    await d.keyboard.press('Escape');
    await d.waitForTimeout(400);
  }
  if (out.desktopBlocks) {
    await blocks.nth(0).click();
    await d.waitForTimeout(2500);
    out.url = d.url();
    out.tabs = await d.getByRole('tab').allInnerTexts();
    out.pay = await d.getByRole('button', { name: /^Оплатить/ }).count();
    await d.screenshot({ path: 'qa/shots/journal/gaps2-window.png' });
    if (out.pay) {
      await d.getByRole('button', { name: /^Оплатить/ }).first().click();
      await d.waitForTimeout(1200);
      out.payDialogText = (await d.locator('[role="dialog"]').last().innerText()).slice(0, 400);
      await d.screenshot({ path: 'qa/shots/journal/gaps2-pay.png' });
    }
  }
  // 3. ссылка на запись без date
  await d.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&booking=bk_1892`, { waitUntil: 'networkidle' });
  await d.waitForTimeout(2500);
  out.deepLinkDialogHead = (await d.locator('[role="dialog"]').last().innerText().catch(() => '')).slice(0, 160);
  out.desktopErrors = derr;
  await dc.close();
} finally {
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  release();
}
