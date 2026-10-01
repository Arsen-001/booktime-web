import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3710/biz/online/page?persona=owner&lang=ru&sphere=nails');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Добавить промоблок' }).click();
  await page.waitForTimeout(400);
  const titleInput = page.locator('[role="dialog"] input, aside input, [class*=sheet] input').first();
  await titleInput.fill('А'.repeat(70));
  const titleVal = await titleInput.inputValue();
  console.log('title length after 70 chars typed:', titleVal.length);

  // выбрать экран "service" в дополнение к menu
  const serviceCheckbox = page.getByText('выбор услуги', { exact: false });
  console.log('service screen option visible:', await serviceCheckbox.count());

  await page.screenshot({ path: 'qa/shots/online-g2-2/promo-limits.png', fullPage: true });

  const saveBtn = page.getByRole('button', { name: 'Сохранить' });
  await saveBtn.click();
  await page.waitForTimeout(700);
  const bodyText = await page.locator('body').innerText();
  console.log('has new block in list:', bodyText.includes('АААААААААААААААААААААААААААААААААААААААААААААА'.slice(0,50)));
  await page.screenshot({ path: 'qa/shots/online-g2-2/promo-limits-after-save.png', fullPage: true });
  await ctx.close();
} finally {
  await browser.close();
  release();
}
