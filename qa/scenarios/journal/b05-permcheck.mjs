import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto('http://localhost:3710/biz/journal/settings?demo=master&sphere=nails&lang=ru', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa/shots/journal/b05-perm-master-settings.png', fullPage: true });
  const saveBtn = await page.getByRole('button', { name: 'Сохранить' }).count();
  const recordTypeButtons = await page.locator('button:has-text("Индивидуальная запись")').count();
  const errState = await page.locator('text=/нет доступа|Недостаточно прав|403|No access/i').count();
  console.log(JSON.stringify({ saveBtn, recordTypeButtons, errState }, null, 2));
  await browser.close();
} finally { release(); }
