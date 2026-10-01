import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';

async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // client card -> "..." menu -> "Изменить"
    await page.goto(`${BASE}/biz/clients/cl_001?persona=owner&lang=ru`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(800);
    const menuBtn = page.locator('button[aria-haspopup="menu"], button:has(svg)').filter({ hasText: '' });
    const moreBtn = page.getByRole('button', { name: /Ещё|еще|Меню|options|more/i }).first();
    let clicked = false;
    for (const cand of [moreBtn]) {
      if (await cand.count()) { await cand.click(); clicked = true; break; }
    }
    if (!clicked) {
      // fallback: last icon-only button in header area
      const iconBtns = page.locator('header button, [class*="header"] button');
      const n = await iconBtns.count();
      console.log('header icon buttons count:', n);
      if (n) { await iconBtns.last().click(); clicked = true; }
    }
    await page.waitForTimeout(400);
    console.log('menu opened attempt:', clicked);
    const editItem = page.getByText('Изменить', { exact: true }).first();
    console.log('edit menu item visible:', await editItem.count());
    if (await editItem.count()) {
      await editItem.click();
      await page.waitForTimeout(600);
    }

    const cf = page.locator('[data-f*="F-04-139"]').first();
    console.log('custom-fields block found in edit sheet:', (await cf.count()) > 0);
    if (await cf.count()) {
      const newFieldInput = cf.getByPlaceholder(/поле|назван/i).first();
      console.log('new field name input found:', await newFieldInput.count());
      if (await newFieldInput.count()) {
        await newFieldInput.fill('Тест число g32m1');
        const typeSelect = cf.locator('[role="combobox"], button').filter({ hasText: /Текст/i }).first();
        if (await typeSelect.count()) {
          await typeSelect.click();
          await page.waitForTimeout(300);
          const opt = page.getByText('Число', { exact: true }).first();
          if (await opt.count()) await opt.click();
        }
        const addBtn = cf.getByRole('button', { name: /Добавить/i }).first();
        if (await addBtn.count()) { await addBtn.click(); await page.waitForTimeout(500); }
        await page.screenshot({ path: 'qa/shots/clients/g3-2-m1-customfield-added.png', fullPage: true });
        const numInput = page.locator('[data-f*="F-04-139"] input[type="number"]').last();
        if (await numInput.count()) {
          await numInput.click();
          await numInput.type('abc123');
          console.log('number field value after typing letters+digits:', JSON.stringify(await numInput.inputValue()));
        } else console.log('no number input found post-add');
      }
      const saveBtn = page.getByRole('button', { name: /^Сохранить$/i }).last();
      if (await saveBtn.count()) { await saveBtn.click(); await page.waitForTimeout(1000); }
    }
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(800);
    const aboutBlock = page.locator('[data-f*="F-04-141"]').first();
    console.log('F-04-141 on card after reload, text:', (await aboutBlock.innerText().catch(() => '(none)')).slice(0, 300));
    await page.screenshot({ path: 'qa/shots/clients/g3-2-m1-card-after-reload.png', fullPage: true });

    // rights block
    await page.goto(`${BASE}/dev/ext/settingsHub/clients?persona=owner&lang=ru`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(800);
    const rightsBlock = page.locator('[data-f*="F-04-084"]').first();
    console.log('rights block present:', (await rightsBlock.count()) > 0);
    if (await rightsBlock.count()) {
      console.log('rights block text:', (await rightsBlock.innerText()).slice(0, 800));
    }
    await page.screenshot({ path: 'qa/shots/clients/g3-2-m1-rights2.png', fullPage: true });
  } finally {
    await browser.close();
    release();
  }
}
main().catch((e) => { console.error('FAILED', e); process.exit(0); });
