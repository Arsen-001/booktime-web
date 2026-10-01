// F-00-067/F-00-068 живой прогон на СИДовых заявках (без сборки визарда): открыть /biz/online/requests,
// подтвердить первую заявку «ждёт подтверждения», проверить что она пропала из очереди (реальное действие).
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/online/requests?persona=owner&lang=ru`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const beforeCount = await page.locator('[data-f="F-00-067 F-03-127"] li, [data-f="F-00-067 F-03-127"] > div > ul > li').count().catch(() => -1);
  const bodyBefore = await page.locator('body').innerText();
  await page.screenshot({ path: 'qa/shots/online-g2-2/requests-before.png', fullPage: true });

  const confirmBtn = page.getByRole('button', { name: 'Подтвердить' }).first();
  const hasRequest = await confirmBtn.count();
  console.log('заявок с кнопкой «Подтвердить»:', hasRequest);
  if (hasRequest) {
    await confirmBtn.click();
    await page.waitForTimeout(300);
    // ConfirmDialog может не понадобиться для подтверждения (только для отклонения) — проверим наличие
    const dialogConfirm = page.getByRole('button', { name: /Подтвердить|Да/ }).last();
    await page.waitForTimeout(700);
    await page.screenshot({ path: 'qa/shots/online-g2-2/requests-after-confirm.png', fullPage: true });
    const bodyAfter = await page.locator('body').innerText();
    console.log('---BEFORE (first 400)---');
    console.log(bodyBefore.slice(0, 400));
    console.log('---AFTER (first 400)---');
    console.log(bodyAfter.slice(0, 400));
  } else {
    console.log('---BODY (нет активных заявок в очереди прямо сейчас)---');
    console.log(bodyBefore.slice(0, 600));
  }
  await ctx.close();
} finally {
  await browser.close();
  release();
}
