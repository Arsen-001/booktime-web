// Проверяющий пропусков journal, круг 3: точечные вопросы без правки кода.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const out = {};
try {
  for (const persona of ['owner', 'master', 'individual']) {
    const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await ph.newPage();
    const perr = [];
    p.on('pageerror', (e) => perr.push(e.message));
    await p.goto(`${BASE}/biz/journal?demo=${persona}&sphere=nails&lang=ru&theme=light&date=2026-09-28`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
    const fb = p.locator('[data-testid="booking-block"]').first();
    const r = {};
    r.firstBlockTop = (await fb.count()) ? (await fb.boundingBox())?.y : null;
    r.blocks = await p.locator('[data-testid="booking-block"]').count();
    r.fab = await p.locator('[data-f="F-01-184"]').count();
    r.modeBtn = await p.locator('[data-f="F-01-001"]').count();
    r.filtersBtn = await p.getByRole('button', { name: /Фильтр/ }).count();
    r.lateBtns = await p.getByText(/Задерживаюсь|Закончил раньше/).count();
    r.errors = perr;
    await p.screenshot({ path: `qa/shots/journal/gaps3-phone-${persona}.png` });
    if (persona === 'owner' && r.fab) {
      await p.locator('[data-f="F-01-184"]').first().click();
      await p.waitForTimeout(2500);
      r.fabUrl = p.url().replace(BASE, '');
      r.windowTabs = await p.getByRole('tab').allInnerTexts();
      const phone = p.locator('input[type="tel"]').first();
      r.phoneInputTop = (await phone.count()) ? (await phone.boundingBox())?.y : null;
      await p.screenshot({ path: `qa/shots/journal/gaps3-phone-window.png` });
    }
    out[persona] = r;
    await ph.close();
  }
  // десктоп: меню «Новая запись», окно записи, «Клиент подтвердил»
  const dc = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await dc.newPage();
  const derr = [];
  d.on('pageerror', (e) => derr.push(e.message));
  await d.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light&date=2026-09-28`, { waitUntil: 'networkidle' });
  await d.waitForTimeout(2500);
  const nb = d.getByRole('button', { name: /Новая запись/ }).first();
  if (await nb.count()) {
    await nb.click();
    await d.waitForTimeout(800);
    out.newMenuItems = await d.getByRole('menuitem').allInnerTexts();
    await d.keyboard.press('Escape');
    await d.waitForTimeout(400);
  }
  out.gridScrollTopHour = await d.locator('text=/^0?8:00$/').count();
  const blocks = d.locator('[data-testid="booking-block"]');
  out.desktopBlocks = await blocks.count();
  out.blockTexts = (await blocks.allInnerTexts()).slice(0, 40).map((s) => s.replace(/\s+/g, ' ').slice(0, 70));
  if (out.desktopBlocks) {
    await blocks.nth(0).click();
    await d.waitForTimeout(2500);
    out.tabs = await d.getByRole('tab').allInnerTexts();
    out.payBtn = await d.getByRole('button', { name: /^Оплатить/ }).count();
    const conf = d.locator('[data-f="F-01-086"]').first();
    if (await conf.count()) {
      await conf.click();
      await d.waitForTimeout(1500);
      out.afterConfirmToast = await d.locator('[role="status"], [data-sonner-toast], [role="alert"]').allInnerTexts().catch(() => []);
    }
    await d.screenshot({ path: 'qa/shots/journal/gaps3-window.png' });
  }
  out.desktopErrors = derr;
  await dc.close();
} finally {
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  release();
}
