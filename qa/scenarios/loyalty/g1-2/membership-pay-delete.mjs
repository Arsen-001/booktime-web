import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
import { chromium } from '@playwright/test';
const release = await acquireBrowserSlot();
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.type()+': ' + m.text()); });
await p.setViewportSize({ width: 1440, height: 900 });
await p.goto('http://localhost:3710/biz/clients?demo=owner&sphere=nails&lang=ru&theme=light');
await p.waitForTimeout(1500);
await p.getByPlaceholder(/[Пп]оиск/).first().fill('95 965 289');
await p.waitForTimeout(900);
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/membership-pay-delete/0-client-search.png', fullPage: true });
const row = p.locator('text=Нелли').first();
if (await row.count()) {
  await row.click();
  await p.waitForTimeout(900);
  await p.screenshot({ path: 'qa/shots/loyalty-g1-2/membership-pay-delete/0b-client-card.png', fullPage: true });
}
console.log('ERRORS:', JSON.stringify(errs));
await b.close();
release();
