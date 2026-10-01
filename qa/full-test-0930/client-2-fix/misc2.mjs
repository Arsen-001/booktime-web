import { start, newPage, go, text } from '../client-2/h.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/client-2-fix';
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` });
const one = (s, n = 500) => (s ?? '').slice(0, n).replace(/\n+/g, ' | ');
const { browser, done } = await start();
try {
  const { page, errors } = await newPage(browser, { device: 'phone' });
  await go(page, '/biz/apps/events', 'owner', '&sphere=fitness');
  console.log('EVENTS', one(await text(page), 300));
  await page.getByRole('button', { name: 'Новое событие' }).first().click(); await page.waitForTimeout(1000);
  const cd = page.getByRole('dialog');
  const combos = cd.getByRole('combobox');
  for (let i = 0; i < 2; i++) { await combos.nth(i).click(); await page.waitForTimeout(400); await page.getByRole('option').first().click(); await page.waitForTimeout(400); }
  await cd.getByRole('button', { name: 'Новое событие' }).last().click().catch((e) => console.log('create', e.message.split('\n')[0]));
  await page.waitForTimeout(2000);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  console.log('AFTER CREATE', one(await text(page), 300));
  const ev = page.locator('main ul li').first();
  if (await ev.count()) {
    await ev.click(); await page.waitForTimeout(1200);
    const d2 = page.getByRole('dialog');
    const dt = await d2.innerText();
    console.log('dialog', one(dt, 400));
    await d2.getByRole('button', { name: 'Отменить событие' }).click(); await page.waitForTimeout(800);
    const alert = page.getByRole('alertdialog');
    console.log('confirm shown:', await alert.count(), one(await alert.innerText().catch(() => ''), 200));
    await shot(page, 'events-cancel-confirm-phone');
  }
  console.log('ERRORS', errors.slice(0, 5));
} catch (e) { console.error('FAIL', e.message); } finally { await done(); }
