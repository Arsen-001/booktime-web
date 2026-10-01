import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/journal/b05-m1';
async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/biz/records?demo=owner&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.locator('[data-f="F-01-036"] button, button:has-text("Запись от бота")').first().click();
    await page.waitForTimeout(300);
    const modal = page.getByRole('dialog');
    await modal.getByPlaceholder(/Как представился/i).fill('Тест Без Телефона');
    const serviceCombo = modal.locator('button:has-text("Выберите услугу"), button:has-text("услугу")').first();
    await serviceCombo.click();
    await page.waitForTimeout(200);
    await page.locator('[role="option"]').first().click().catch(() => {});
    await page.waitForTimeout(200);
    const submit = modal.getByRole('button', { name: /Создать запись/i });
    console.log('submit disabled?', await submit.isDisabled());
    await submit.click({ timeout: 5000, force: true });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/f036-submit-no-phone-result.png` });
    const errVisible = await page.locator('text=/Без телефона бот запись создать не может/i').isVisible().catch(() => false);
    const createdToast = await page.locator('text=/Запись от бота создана/i').isVisible().catch(() => false);
    console.log('error shown:', errVisible, 'created anyway:', createdToast);
    await ctx.close();
  } finally {
    await browser.close();
    release();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
