import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
import { chromium } from '@playwright/test';
const release = await acquireBrowserSlot();
const b = await chromium.launch();
const context = await b.newContext();
const p = await context.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.type()+': ' + m.text()); });
await p.setViewportSize({ width: 1440, height: 900 });
await p.goto('http://localhost:3710/biz/loyalty?demo=owner&sphere=nails&lang=ru&theme=light');
await p.waitForTimeout(1500);
const [popup] = await Promise.all([
  context.waitForEvent('page', { timeout: 4000 }).catch(() => null),
  p.getByRole('button', { name: 'Настроить' }).nth(0).click(),
]);
await p.waitForTimeout(800);
console.log('MAIN_URL:', p.url());
if (popup) {
  await popup.waitForLoadState().catch(()=>{});
  console.log('POPUP_URL:', popup.url());
  await popup.screenshot({ path: 'qa/shots/loyalty-g1-2/hub-nav2/popup.png', fullPage: true }).catch(()=>{});
} else {
  console.log('NO_POPUP');
}
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/hub-nav2/main-after.png', fullPage: true });
console.log('ERRORS:', JSON.stringify(errs));
await b.close();
release();
