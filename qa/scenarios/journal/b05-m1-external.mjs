// F-01-036: демо "запись от бота/CRM" на /biz/records
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';
const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/journal/b05-m1';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
function log(name, ok, note) { results.push({ name, ok, note }); console.log(`${ok ? '✅' : '❌'} ${name}${note ? ' — ' + note : ''}`); }

async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(`${BASE}/biz/records?demo=owner&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const btn = page.locator('[data-f="F-01-036"] button, button:has-text("Запись от бота")').first();
    const btnVisible = await btn.isVisible().catch(() => false);
    log('F-01-036: кнопка "Запись от бота (демо)" найдена на /biz/records', btnVisible);
    if (!btnVisible) { await ctx.close(); return; }
    await btn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/f036-modal-open.png` });
    const modal = page.getByRole('dialog');
    const submit = modal.getByRole('button', { name: /Создать запись/i });
    // заполняем имя + услугу, БЕЗ телефона
    const nameInput = modal.getByPlaceholder(/Как представился/i);
    await nameInput.fill('Тестовый Бот Клиент');
    const serviceCombo = modal.locator('button:has-text("Выберите услугу"), button:has-text("услугу")').first();
    if (await serviceCombo.isVisible().catch(() => false)) {
      await serviceCombo.click();
      await page.waitForTimeout(200);
      await page.locator('[role="option"]').first().click().catch(() => {});
    }
    await page.waitForTimeout(200);
    const disabledNoPhone = await submit.isDisabled().catch(() => false);
    await page.screenshot({ path: `${OUT}/f036-no-phone.png` });
    log('F-01-036: без телефона кнопка "Создать запись" недоступна (проактивная защита вместо ошибки после отправки)', disabledNoPhone);

    // добавляем телефон
    const phoneInput = modal.locator('input[type=tel], input[inputmode=tel]').first();
    if (await phoneInput.isVisible().catch(() => false)) await phoneInput.fill('91234567');
    await page.waitForTimeout(200);
    const enabledWithPhone = await submit.isEnabled().catch(() => false);
    await page.screenshot({ path: `${OUT}/f036-filled.png` });
    log('F-01-036: с телефоном кнопка становится доступна', enabledWithPhone);
    if (enabledWithPhone) {
      await submit.click({ timeout: 5000 });
      await page.waitForTimeout(900);
      const created = await page.locator('text=/Запись от бота создана/i').isVisible().catch(() => false);
      await page.screenshot({ path: `${OUT}/f036-created.png` });
      log('F-01-036: с телефоном — запись создаётся (тост + открывает в журнале)', created);
    }
    log('F-01-036: без ошибок страницы', errs.length === 0, errs.join('|'));
    await ctx.close();
  } finally {
    await browser.close();
    release();
  }
  fs.writeFileSync(`${OUT}/results-external.json`, JSON.stringify(results, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
