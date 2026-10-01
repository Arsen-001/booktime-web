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
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/membership3/0-loyalty-tab-precheck.png', fullPage: true });
await p.getByRole('button', { name: 'Списать визит' }).click();
await p.waitForTimeout(600);
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/membership3/1-visit-applied.png', fullPage: true });
const payBtn = p.getByRole('button', { name: 'Провести оплату лояльностью' });
if (await payBtn.count()) {
  await payBtn.click();
  await p.waitForTimeout(900);
  await p.screenshot({ path: 'qa/shots/loyalty-g1-2/membership3/2-after-full-pay.png', fullPage: true });
}
// check membership balance right now via memberships list (may reflect in-memory via api not localStorage-dependent for THIS TAB reload? use same-tab navigation, not goto, keep memory)
await p.getByRole('link', { name: /Лояльность/ }).first().click().catch(()=>{});
await p.waitForTimeout(500);
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/membership3/3-after-nav-attempt.png', fullPage: true });

// delete the paid appointment: reopen record via journal search / go straight through goto same tab context (keeps in-memory redux only if SPA nav; goto = hard reload)
console.log('ERRORS:', JSON.stringify(errs));
await b.close();
release();
