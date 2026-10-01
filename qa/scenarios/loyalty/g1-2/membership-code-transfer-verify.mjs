import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
import { chromium } from '@playwright/test';
const release = await acquireBrowserSlot();
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.type()+': ' + m.text()); });
await p.setViewportSize({ width: 1440, height: 900 });
await p.goto('http://localhost:3710/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light');
await p.waitForTimeout(1800);
await p.getByText('Педикюр классический').first().click();
await p.waitForTimeout(700);
await p.getByRole('tab', { name: 'Лояльность' }).click();
await p.waitForTimeout(900);
await p.getByPlaceholder('Номер').fill('MEMB-1000');
await p.getByRole('button', { name: 'Найти' }).click();
await p.waitForTimeout(900);
await p.getByRole('button', { name: 'Списать визит' }).click();
await p.waitForTimeout(700);
await p.getByRole('button', { name: 'Провести оплату лояльностью' }).click();
await p.waitForTimeout(1200);
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/final/4-membership-code-after-pay.png', fullPage: true });

// same session, SPA navigation (not full reload) to memberships list
await p.getByRole('link', { name: 'Абонементы' }).first().click().catch(async () => {
  await p.goto('http://localhost:3710/biz/loyalty/memberships?demo=owner&sphere=nails&lang=ru&theme=light');
});
await p.waitForTimeout(1200);
const bodyText = await p.locator('body').innerText();
console.log('MEMB-1000 row present:', bodyText.includes('MEMB-1000'));
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/final/5-memberships-after-transfer.png', fullPage: true });
console.log('ERRORS:', JSON.stringify(errs));
await b.close();
release();
