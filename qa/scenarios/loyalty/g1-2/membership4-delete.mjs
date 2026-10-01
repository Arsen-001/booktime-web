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
await p.locator('text=Нелли').first().click();
await p.waitForLoadState('networkidle').catch(()=>{});
await p.waitForTimeout(1200);
await p.getByText('Следующая запись').first().waitFor({ timeout: 15000 });
await p.getByText('Следующая запись').first().locator('..').click();
await p.waitForTimeout(900);
await p.getByRole('tab', { name: 'Лояльность' }).click();
await p.waitForTimeout(700);
await p.getByRole('button', { name: 'Списать визит' }).click();
await p.waitForTimeout(600);
await p.getByRole('button', { name: 'Провести оплату лояльностью' }).click();
await p.waitForTimeout(900);
await p.getByRole('tab', { name: 'Запись' }).click();
await p.waitForTimeout(500);
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/membership4/1-record-tab-paid.png', fullPage: true });
// delete via trash icon next to date/time
const trash = p.locator('button:has(svg)').filter({ hasText: '' }).first();
await p.locator('[class*=trash], button[aria-label*="дал"], button[aria-label*="Удал"]').first().click({ timeout: 5000 }).catch(async () => {
  // fallback: click the small trash icon near client name block
  await p.locator('svg').first();
});
await p.waitForTimeout(700);
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/membership4/2-after-delete-click.png', fullPage: true });
console.log('ERRORS:', JSON.stringify(errs));
await b.close();
release();
