import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';

const release = await acquireBrowserSlot();
try {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const warnings = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text());
  });
  await page.goto('http://localhost:3710/biz/loyalty/card-types?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.getByText('Постоянный гость', { exact: false }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Удалить тип' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await page.waitForTimeout(1000);
  const info = await page.evaluate(() => {
    let total = 0;
    let bpSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k) ?? '';
      total += k.length + v.length;
      if (k === 'bp-mock-db') bpSize = v.length;
    }
    return { keys: localStorage.length, totalChars: total, bpMockDbChars: bpSize };
  });
  console.log('STORAGE_INFO', JSON.stringify(info, null, 2));
  console.log('WARNINGS', JSON.stringify(warnings.slice(0, 5), null, 2));
  await browser.close();
} finally {
  release();
}
