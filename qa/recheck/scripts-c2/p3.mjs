import { start, stop, open, as, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('platform', '/platform/connect', { device: 'desktop' });
const d0 = await db(page);
const btn = page.getByRole('button', { name: /Начать подключение|Подключить новый/ }); if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(600); }
for (let i = 0; i < 10; i++) {
  const body = await text(page);
  console.log('STEP', i, body.slice(0, 700).replace(/\n/g,' | '));
  const inputs = await page.locator('main input:visible').evaluateAll(els=>els.map(e=>e.placeholder+'='+e.value));
  console.log('   inputs', inputs.slice(0,8));
  const next = page.getByRole('button', { name: 'Далее' });
  if (await next.count() && await next.isEnabled()) { await next.click(); await page.waitForTimeout(900); continue; }
  console.log('   buttons', (await page.getByRole('button').allInnerTexts()).slice(-10)); break;
}
await stop();
