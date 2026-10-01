// F-07-014/015: у оплаты визита на странице операции нет «Отменить»/«Изменить» (подсказка), ручную — можно отменить
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/finance';
const B = 'http://localhost:3710';
const log = (...a) => console.log(...a);
const release = await acquireBrowserSlot({ timeoutMs: 120 * 60_000 });
const browser = await chromium.launch({ headless: true });
let pass = 0, fail = 0;
const check = (n, ok, info = '') => { ok ? pass++ : fail++; log(ok ? 'PASS' : 'FAIL', n, info); };
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(600_000);
  const go = async (p) => { await page.goto(B + p, { waitUntil: 'domcontentloaded', timeout: 600_000 }); await page.waitForLoadState('networkidle', { timeout: 600_000 }).catch(() => {}); await page.waitForTimeout(2000); };
  await go('/biz/finance?demo=owner&sphere=dental&lang=ru&empty=0');
  await page.locator('a[href*="/biz/finance/operations/"]').first().waitFor({ timeout: 600_000 });
  const hrefs = await page.evaluate(() => {
    const out = { booking: null, manual: null };
    for (const a of document.querySelectorAll('a[href*="/biz/finance/operations/"]')) {
      const row = a.closest('tr');
      if (!row) continue;
      const hasVisit = row.querySelector('a[href*="/biz/journal?booking="]');
      if (hasVisit && !out.booking) out.booking = a.getAttribute('href');
      if (!hasVisit && !out.manual && !/Перевод/.test(row.textContent)) out.manual = a.getAttribute('href');
    }
    return out;
  });
  log('hrefs', JSON.stringify(hrefs));
  if (hrefs.booking) {
    await go(hrefs.booking);
    await page.getByText('Источник').first().waitFor({ timeout: 600_000 }).catch(() => {});
    const t = (await page.locator('main').innerText()).replace(/\s*\n\s*/g, ' | ');
    log('BOOKING OP', t.slice(0, 500));
    await page.screenshot({ path: `${OUT}/detail-booking-op-desktop.png`, fullPage: true });
    const btns = await page.locator('main').getByRole('button').allInnerTexts();
    check('F-07-014: у оплаты визита нет «Отменить операцию»/«Изменить»', !btns.some((b) => /^Отменить$|^Изменить|^Редактировать/.test(b.trim())), JSON.stringify(btns));
    check('F-07-014: подсказка «изменить в окне визита» и ссылка на визит', /окне визита/.test(t) && (await page.locator('a[href*="/biz/journal?booking="]').count()) > 0);
  } else check('нашли операцию оплаты визита в списке', false);
  if (hrefs.manual) {
    await go(hrefs.manual);
    const btn = page.locator('main').getByRole('button', { name: /^Отменить$/ }).first();
    check('F-07-015: у ручной операции есть «Отменить»', (await btn.count()) > 0);
    if (await btn.count()) {
      await btn.click();
      const dlg = page.getByRole('alertdialog').or(page.getByRole('dialog')).last();
      await dlg.waitFor();
      await dlg.getByRole('button', { name: /Отменить операцию/ }).last().click();
      await page.waitForTimeout(3000);
      const t = (await page.locator('main').innerText()).replace(/\s*\n\s*/g, ' | ');
      await page.screenshot({ path: `${OUT}/detail-manual-cancelled-desktop.png`, fullPage: true });
      check('F-07-015: после подтверждения — «Отменена»', /Отменена/.test(t), t.slice(0, 200));
    }
  } else log('manual op not found in first page');
} catch (e) { check('сценарий', false, e.message.split('\n')[0]); }
finally { await browser.close(); release(); log(`ИТОГ ${pass}/${pass + fail}`); }
