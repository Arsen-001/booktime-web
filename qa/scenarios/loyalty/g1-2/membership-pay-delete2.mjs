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
await p.waitForTimeout(900);
await p.getByText('Следующая запись').locator('..').click();
await p.waitForTimeout(900);
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/membership2/0-opened.png', fullPage: true });

const loyTab = p.getByRole('tab', { name: 'Лояльность' });
if (await loyTab.count()) {
  await loyTab.click();
  await p.waitForTimeout(700);
  await p.screenshot({ path: 'qa/shots/loyalty-g1-2/membership2/1-loyalty-tab.png', fullPage: true });
}
console.log('ERRORS:', JSON.stringify(errs));
await b.close();
release();
