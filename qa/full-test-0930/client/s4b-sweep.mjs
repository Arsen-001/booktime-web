// С4: обход остальных функций клиента действием
import { start, newPage, go, shot, text, coreGet, hydrate } from './h.mjs';

const { browser, done } = await start();
const log = (...a) => console.log(...a);
const step = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    log(`STEP FAILED ${name}:`, String(e.message).slice(0, 300));
  }
};
try {
  const { page, errors, ctx } = await newPage(browser);
  await go(page, '/');
  await step('reschedule', async () => {
    await go(page, '/bookings');
    const card = page.locator('a[href^="/bookings/bk"]').first();
    const href = await card.getAttribute('href');
    const id = href.split('/').pop();
    const before = ((await coreGet(page, 'bookings')) ?? []).find((b) => b.id === id);
    await go(page, `${href}/reschedule`);
    log('--- reschedule\n', (await text(page)).slice(0, 600));
    await shot(page, 's4-06-reschedule');
    const slot = page.locator('button.min-h-11').filter({ hasText: /^\s*\d{1,2}:\d{2}\s*$/ }).nth(1);
    await slot.click();
    await page.waitForTimeout(500);
    await page.waitForTimeout(3000);
    const after = ((await coreGet(page, 'bookings')) ?? []).find((b) => b.id === id);
    log('--- after reschedule page\n', (await text(page)).slice(0, 400));
    log('reschedule', before?.start, '→', after?.start, after?.status, page.url());
    await shot(page, 's4-07-rescheduled');
  });
  await step('diary', async () => {
    await go(page, '/diary');
    log('--- diary\n', (await text(page)).slice(0, 600));
    await shot(page, 's4-08-diary');
  });
  await step('notifications', async () => {
    await go(page, '/notifications');
    const t = await text(page);
    log('Пора снова present:', t.includes('Пора снова'));
    log('--- notif\n', t.slice(0, 700));
  });
  await step('api=error', async () => {
    await go(page, '/bookings', 'client', '&api=error');
    await page.waitForTimeout(2500);
    log('--- bookings api=error\n', (await text(page)).slice(0, 400));
    await shot(page, 's4-09-bookings-error');
    await go(page, '/', 'client', '&api=error');
    await page.waitForTimeout(2500);
    log('--- home api=error\n', (await text(page)).slice(0, 600));
    await shot(page, 's4-10-home-error');
    await go(page, '/profile', 'client', '&api=normal');
  });
  await step('guest', async () => {
    await go(page, '/bookings', 'guest');
    log('--- guest bookings\n', (await text(page)).slice(0, 300));
    await go(page, '/book?staff=st_kaytsak_erik', 'guest');
    log('--- guest book\n', (await text(page)).slice(0, 300));
    await go(page, '/profile', 'guest');
    log('--- guest profile\n', (await text(page)).slice(0, 300));
    await go(page, '/login', 'guest');
    await shot(page, 's4-11-login');
    log('--- login\n', (await text(page)).slice(0, 500));
  });
  await step('en', async () => {
    const en = await newPage(browser);
    await en.page.goto('http://localhost:3710/bookings?demo=client&lang=en', { waitUntil: 'domcontentloaded', timeout: 180000 });
    await hydrate(en.page);
    await shot(en.page, 's4-12-bookings-en');
    log('--- en bookings\n', (await text(en.page)).slice(0, 500));
    await en.ctx.close();
  });
  await step('desktop detail', async () => {
    const dk = await newPage(browser, { device: 'desktop' });
    await go(dk.page, '/bookings');
    const href = await dk.page.locator('a[href^="/bookings/bk"]').first().getAttribute('href');
    await go(dk.page, href);
    await shot(dk.page, 's4-13-detail-desktop');
    await go(dk.page, '/');
    await shot(dk.page, 's4-14-home-desktop');
    await dk.ctx.close();
  });
  log('errors', errors);
  await ctx.close();
} finally {
  await done();
}
