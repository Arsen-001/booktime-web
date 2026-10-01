// Проверяющий пропусков journal, круг 4: точечные вопросы без правки кода.
// 1) телефон owner/master: метка круглой «+», кнопка режима, «Задерживаюсь/Закончил раньше»;
// 2) десктоп owner: меню «Новая запись»; запись с предоплатой — сколько блоков политики оплаты в окне
//    (журнальный F-01-146 и finance F-07-114) и два ли решения по штрафу.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const out = {};
try {
  for (const persona of ['owner', 'master']) {
    const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await ph.newPage();
    const perr = [];
    p.on('pageerror', (e) => perr.push(e.message));
    await p.goto(`${BASE}/biz/journal?demo=${persona}&sphere=nails&lang=ru&theme=light&date=2026-09-28`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
    const r = {};
    r.fabMarked = await p.locator('[data-f="F-01-184"]').count();
    r.fabAny = await p.locator('[data-fab]').count();
    r.modeBtn = await p.locator('[data-f="F-01-001"]').count();
    r.lateBtns = await p.getByText(/Задерживаюсь|Закончил раньше/).count();
    r.errors = perr;
    out[persona] = r;
    await ph.close();
  }
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
  // запись с предоплатой: перебираю блоки нескольких дней, пока в окне не появится журнальный F-01-146
  out.window = null;
  outer: for (const date of ['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']) {
    await d.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light&date=${date}`, { waitUntil: 'networkidle' });
    await d.waitForTimeout(2000);
    const n = await d.locator('[data-testid="booking-block"]').count();
    for (let i = 0; i < Math.min(n, 14); i++) {
      await d.locator('[data-testid="booking-block"]').nth(i).click({ force: true }).catch(() => {});
      await d.waitForTimeout(1800);
      const jp = await d.locator('[data-f~="F-01-146"]').count();
      if (jp) {
        const w = { date, i, url: d.url().replace(BASE, ''), journalPolicy: jp };
        w.tabs = await d.getByRole('tab').allInnerTexts();
        w.journalPolicyText = (await d.locator('[data-f~="F-01-146"]').first().innerText()).replace(/\s+/g, ' ').slice(0, 200);
        const payTab = d.getByRole('tab', { name: /Оплата/ }).first();
        if (await payTab.count()) { await payTab.click(); await d.waitForTimeout(3500); }
        w.financePolicy = await d.locator('[data-f~="F-07-114"]').count();
        w.financePolicyText = w.financePolicy ? (await d.locator('[data-f~="F-07-114"]').first().innerText()).replace(/\s+/g, ' ').slice(0, 200) : null;
        w.journalPolicyAfterTab = await d.locator('[data-f~="F-01-146"]').count();
        await d.screenshot({ path: 'qa/shots/journal/gaps4-window-policy.png', fullPage: true });
        out.window = w;
        break outer;
      }
      await d.keyboard.press('Escape');
      await d.waitForTimeout(500);
      if (!d.url().endsWith(`date=${date}`)) {
        await d.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light&date=${date}`, { waitUntil: 'networkidle' });
        await d.waitForTimeout(1500);
      }
    }
  }
  out.desktopErrors = derr;
  await dc.close();
} finally {
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  release();
}
