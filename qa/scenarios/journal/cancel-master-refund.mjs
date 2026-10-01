// Живой прогон: decision-c3-3 — «Отменил мастер» с оплаченной предоплатой должен показать ConfirmDialog
// с суммой возврата. Ищем запись с бейджем предоплаты на /biz/journal, открываем окно, жмём статус
// «Отменил мастер», проверяем диалог.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';

async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([
      { name: 'demo_persona', value: 'owner', domain: 'localhost', path: '/' },
      { name: 'demo_sphere', value: 'nails', domain: 'localhost', path: '/' },
      { name: 'demo_lang', value: 'ru', domain: 'localhost', path: '/' },
    ]);
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    await page.goto(`${BASE}/biz/journal`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // Пройти несколько записей в поисках оплаченной предоплаты — кликаем по блокам записей по очереди.
    const blocks = page.locator('[data-f*="F-01-0"][class*="cursor"], [data-testid="booking-block"], .booking-block, [data-booking-id]');
    let count = await blocks.count();
    if (count === 0) {
      // запасной селектор: любой элемент с ролью button внутри сетки, содержащий время
      count = 0;
    }
    let found = false;
    let triedCount = 0;
    let screenshots = [];

    for (let i = 0; i < Math.min(count, 40) && !found; i++) {
      await blocks.nth(i).click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
      const prepaidBadge = page.getByText(/предоплат/i).first();
      const visible = await prepaidBadge.isVisible().catch(() => false);
      triedCount++;
      if (visible) {
        found = true;
        break;
      }
      // закрыть окно, если открылось без предоплаты
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(200);
    }

    const result = { blocksFound: count, tried: triedCount, foundPrepaidWindow: found, consoleErrors };

    if (found) {
      const shot1 = 'qa/shots/journal-cancel-master-refund/01-window-with-prepayment.png';
      await page.screenshot({ path: shot1 });
      screenshots.push(shot1);

      const cancelBtn = page.getByText('Отменил мастер', { exact: false }).first();
      const btnVisible = await cancelBtn.isVisible().catch(() => false);
      result.cancelButtonVisible = btnVisible;
      if (btnVisible) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
        const shot2 = 'qa/shots/journal-cancel-master-refund/02-after-click.png';
        await page.screenshot({ path: shot2 });
        screenshots.push(shot2);
        const dialog = page.getByRole('dialog');
        const dialogVisible = await dialog.isVisible().catch(() => false);
        result.confirmDialogVisible = dialogVisible;
        if (dialogVisible) {
          result.dialogText = await dialog.innerText().catch(() => '');
        }
      }
    }

    result.consoleErrorsFinal = consoleErrors;
    console.log(JSON.stringify(result, null, 2));
    await ctx.close();
  } finally {
    await browser.close();
    release();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
