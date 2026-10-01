// Проверка g3-2-m1: доп. поля клиента (F-04-139/140/141/142/145), напоминание по записи (F-04-100 п.2),
// права лояльности (F-04-084), права медраздела/сети (F-04-150/184). Измеритель, код не правит.
// Запуск: node qa/scenarios/clients/g3-2-m1-fields.mjs
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';

async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', (m) => { if (m.type() === 'error') logs.push('CONSOLE ERR: ' + m.text()); });
    page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));

    // 1. Открыть карточку клиента cl_001 -> "Изменить" -> доп. поля
    await page.goto(`${BASE}/biz/clients/cl_001?persona=owner&lang=ru`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(800);
    const editBtn = page.locator('button:has-text("Изменить"), button:has-text("Редактировать")').first();
    if (await editBtn.count()) {
      await editBtn.click();
      await page.waitForTimeout(600);
    } else {
      console.log('EDIT BUTTON NOT FOUND on client card');
    }

    const cf = page.locator('[data-f*="F-04-139"]').first();
    const cfVisible = await cf.count();
    console.log('custom-fields block found in edit sheet:', cfVisible > 0);

    if (cfVisible) {
      // Add number-type field
      const addNewInput = cf.locator('input[placeholder]').first();
      await addNewInput.waitFor({ timeout: 5000 }).catch(() => {});
      const newFieldInput = cf.getByPlaceholder(/поле/i).first();
      if (await newFieldInput.count()) {
        await newFieldInput.fill('Тестовое число g3-2-m1');
        const typeSelect = cf.locator('button, [role="combobox"]').filter({ hasText: /Текст|Число|Дата|Список/i }).first();
        if (await typeSelect.count()) {
          await typeSelect.click();
          await page.waitForTimeout(300);
          const numberOpt = page.getByText('Число', { exact: true }).first();
          if (await numberOpt.count()) await numberOpt.click();
        }
        const addBtn = cf.getByRole('button', { name: /Добавить/i }).first();
        if (await addBtn.count()) {
          await addBtn.click();
          await page.waitForTimeout(600);
        }
        console.log('after add: custom field block html length', (await cf.innerText().catch(() => '')).length);
        await page.screenshot({ path: 'qa/shots/clients/g3-2-m1-customfield-added.png', fullPage: true });

        // try typing letters into the number field
        const numInput = cf.locator('input[type="number"]').last();
        if (await numInput.count()) {
          await numInput.fill('');
          await numInput.type('abc123xyz');
          const val = await numInput.inputValue();
          console.log('number field after typing "abc123xyz" -> value:', JSON.stringify(val));
        } else {
          console.log('NO number input found after adding number-type field');
        }
      } else {
        console.log('new-field name input not found');
      }
    }

    // 2. Save and reload, check field persists on client card (F-04-139 criterion)
    const saveBtn = page.getByRole('button', { name: /Сохранить/i }).first();
    if (await saveBtn.count()) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
    }
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(800);
    const aboutBlock = page.locator('[data-f*="F-04-141"]').first();
    const aboutText = await aboutBlock.innerText().catch(() => '(not found)');
    console.log('F-04-141 block on card after reload:', aboutText.slice(0, 300));

    // 3. Booking window: F-04-100 reminder + F-04-141 field visibility
    await page.goto(`${BASE}/dev/ext/bookingWindow/clients?persona=owner&lang=ru`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(1000);
    const reminderBlock = page.locator('[data-f="F-04-100"]').nth(1);
    console.log('reminder block (2nd F-04-100) present:', (await reminderBlock.count()) > 0);
    if (await reminderBlock.count()) {
      const text = await reminderBlock.innerText().catch(() => '');
      console.log('reminder block text:', text.slice(0, 200));
    }
    await page.screenshot({ path: 'qa/shots/clients/g3-2-m1-bookingwindow.png', fullPage: true });

    // 4. Rights: F-04-084 (8 checkboxes), F-04-150, F-04-184 in settingsHub
    await page.goto(`${BASE}/dev/ext/settingsHub/clients?persona=owner&lang=ru`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(800);
    const r084 = await page.locator('[data-f="F-04-084"]').count();
    const r150 = await page.locator('[data-f="F-04-150"]').count();
    const r184 = await page.locator('[data-f="F-04-184"]').count();
    console.log('settingsHub blocks: F-04-084 count=', r084, 'F-04-150 count=', r150, 'F-04-184 count=', r184);
    if (r084) {
      const txt = await page.locator('[data-f="F-04-084"]').innerText().catch(() => '');
      console.log('F-04-084 text (first 500):', txt.slice(0, 500));
    }
    await page.screenshot({ path: 'qa/shots/clients/g3-2-m1-rights.png', fullPage: true });

    console.log('\n--- console/page errors captured ---');
    console.log(logs.length ? logs.join('\n') : '(none)');
  } finally {
    await browser.close();
    release();
  }
}

main().catch((e) => { console.error('SCENARIO FAILED:', e); process.exit(0); });
