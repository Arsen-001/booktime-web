// Сеть: филиал по умолчанию (F-14-163); права ролей в /biz/apps; гость на клиентских экранах
import { start, newPage, go, shot, text } from './h.mjs';

const { browser, done } = await start();
const log = (...a) => console.log(...a);
const one = (s, n = 600) => (s ?? '').slice(0, n).replace(/\n+/g, ' | ');
const sect = async (name, fn) => { try { await fn(); } catch (e) { log(`!! ${name} FAIL:`, e.message.split('\n')[0]); } };
try {
  const { page, errors } = await newPage(browser, { device: 'phone' });

  await sect('network-default', async () => {
    await go(page, '/places/biz_manana_nn', 'client');
    const sec = page.locator('[data-f="F-14-163"]');
    await sec.scrollIntoViewIfNeeded().catch(() => {});
    log('BRANCHES:', one(await sec.innerText().catch(() => 'no section'), 500));
    await shot(page, 'm-place-branches');
    const btn = sec.getByRole('button').last();
    if (await btn.count()) {
      log('click:', await btn.innerText());
      await btn.click();
      await page.waitForTimeout(1500);
      log('BRANCHES after:', one(await sec.innerText(), 500));
      await page.reload();
      await page.waitForTimeout(3000);
      log('BRANCHES after reload:', one(await page.locator('[data-f="F-14-163"]').innerText().catch(() => ''), 500));
    }
    await go(page, '/places/biz_manana_nn', 'guest');
    log('GUEST BRANCHES:', one(await page.locator('[data-f="F-14-163"]').innerText().catch(() => 'no section'), 400));
  });

  await sect('roles-apps', async () => {
    for (const p of ['master', 'admin', 'network', 'individual', 'client', 'guest']) {
      await go(page, '/biz/apps/reports', p);
      log(`REPORTS as ${p}:`, page.url().replace('http://localhost:3710', ''), one(await text(page), 250));
    }
    await go(page, '/biz/apps/payroll', 'network');
    log('PAYROLL as network:', one(await text(page), 300));
    await shot(page, 'm-payroll-network');
    await go(page, '/biz/apps/payroll', 'master');
    log('PAYROLL as master:', one(await text(page), 300));
    await go(page, '/biz/apps/team', 'master');
    log('TEAM as master:', one(await text(page), 300));
    await shot(page, 'm-team-master');
    await go(page, '/biz/apps/visit', 'master');
    log('VISIT as master:', one(await text(page), 300));
  });

  await sect('guest', async () => {
    for (const r of ['/profile', '/profile/notifications', '/notifications', '/bookings', '/favorites']) {
      await go(page, r, 'guest');
      log(`GUEST ${r}:`, page.url().replace('http://localhost:3710', ''), one(await text(page), 200));
    }
    await shot(page, 'm-guest-favorites');
  });

  await sect('desktop', async () => {
    const { page: dp } = await newPage(browser, { device: 'desktop' });
    for (const r of ['/biz/apps', '/biz/apps/visit', '/biz/apps/branded', '/biz/apps/team']) {
      await go(dp, r, 'owner');
      await dp.screenshot({ path: `/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/client-2/d-${r.replace(/\//g, '_')}.png` });
    }
    await go(dp, '/profile', 'client');
    await dp.screenshot({ path: '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/client-2/d-profile.png' });
    await go(dp, '/profile/notifications', 'client');
    await dp.screenshot({ path: '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/client-2/d-notif-settings.png' });
  });

  log('ERRORS:', errors.slice(0, 10));
} catch (e) {
  console.error('FAIL', e);
} finally {
  await done();
}
