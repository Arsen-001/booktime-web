import { chromium } from 'playwright';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';

const routes = [
  ['/biz/loyalty/certificates', 'certificates.csv', /Выгрузить в Excel/i],
  ['/biz/loyalty/transactions', 'loyalty-transactions.csv', /Операции с Excel/i],
  ['/biz/loyalty/memberships', 'memberships.csv', /Операции с Excel/i],
  ['/biz/loyalty/deposits/operations', 'account-operations.csv', /Выгрузить в Excel/i],
];

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  for (const [path, expectedFile, btnRe] of routes) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`http://localhost:3710${path}?demo=owner`, { waitUntil: 'networkidle' });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }),
      page.getByRole('button', { name: btnRe }).click(),
    ]);
    const suggested = download.suggestedFilename();
    console.log(path, '->', suggested, suggested === expectedFile ? 'OK' : 'MISMATCH');
    await ctx.close();
  }
} finally {
  await browser.close();
  release();
}
