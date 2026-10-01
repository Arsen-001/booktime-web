import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const star = page.locator('[data-f="F-01-005"]');
  const before = await star.locator('svg').getAttribute('class');
  await star.click();
  await page.waitForTimeout(1500);
  const after = await star.locator('svg').getAttribute('class');
  console.log('before:', before);
  console.log('after:', after);
  // reload check persistence
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const afterReload = await star.locator('svg').getAttribute('class');
  console.log('afterReload:', afterReload);
  // is there any visible "Избранное" text anywhere on the page?
  const favText = await page.getByText('Избранное', { exact: false }).count();
  console.log('Избранное text count on page:', favText);
} finally {
  await browser.close();
  release();
}
