import { start, newPage, go, text } from '../client-2/h.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/client-2-fix';
const one = (s, n = 300) => (s ?? '').slice(0, n).replace(/\n+/g, ' | ');
const { browser, done } = await start();
try {
  for (const persona of ['admin', 'master', 'network']) {
    const { page, ctx } = await newPage(browser, { device: 'desktop' });
    await go(page, '/biz/apps/payroll', persona);
    console.log(persona, 'picker:', await page.getByText('Выберите сотрудника').count(), '|', one(await text(page)));
    await page.screenshot({ path: `${OUT}/${persona}-payroll2-desktop.png` });
    await ctx.close();
  }
  const { page } = await newPage(browser, { device: 'desktop' });
  await go(page, '/biz/apps/team', 'owner');
  await page.locator('main li').filter({ hasText: 'Владелец' }).first().click(); await page.waitForTimeout(1000);
  console.log('owner card:', one(await page.getByRole('dialog').innerText(), 400));
  await page.screenshot({ path: `${OUT}/owner-team-owner2-desktop.png` });
} catch (e) { console.error('FAIL', e.message); } finally { await done(); }
