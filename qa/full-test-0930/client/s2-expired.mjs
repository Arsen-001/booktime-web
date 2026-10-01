// С2: заявка к мастеру с подтверждением → мастер не ответил (часы +3 ч) → окна, без «мастер отменил»
import { start, newPage, go, shot, text, coreGet, hydrate, areaGet } from './h.mjs';

const STAFF = process.env.S2_STAFF ?? 'st_atam_ashot';
const { browser, done } = await start();
const log = (...a) => console.log(...a);
try {
  const now = Date.now();
  const { page, errors } = await newPage(browser, { clock: now });
  await go(page, '/');
  await go(page, `/book?staff=${STAFF}`);
  const radios = page.getByRole('radio');
  if (await radios.count()) {
    await radios.first().click();
    await page.getByRole('button', { name: 'Продолжить' }).first().click();
    await page.waitForTimeout(800);
  }
  // окно подальше от «сейчас»: второй день полосы, чтобы срок ответа = создание + 2 ч
  const days = page.locator('button.min-w-16');
  if ((await days.count()) > 2) {
    await days.nth(2).click();
    await page.waitForTimeout(600);
  }
  const slot = page.locator('button.min-h-11').filter({ hasText: /^\s*\d{1,2}:\d{2}\s*$/ }).first();
  log('slot', await slot.innerText());
  await slot.click();
  await page.waitForTimeout(600);
  const cont = page.getByRole('button', { name: 'Продолжить' });
  if (await cont.count()) {
    await cont.first().click();
    await page.waitForTimeout(600);
  }
  await page.getByRole('button', { name: 'Подтвердить запись' }).click();
  await page.waitForTimeout(2500);
  log('--- done\n', (await text(page)).slice(0, 600));
  const all = await coreGet(page, 'bookings');
  { const cl0 = await areaGet(page, 'client'); log('memberships before', JSON.stringify((cl0?.memberships ?? []).filter((m) => m.appUserId === 'au_01').map((m) => [m.id, m.visitsLeft]))); }
  const b = all.filter((x) => x.staffId === STAFF && x.appUserId === 'au_01').sort((a, c) => c.createdAt.localeCompare(a.createdAt))[0];
  log('booking', b.id, b.status, b.start, b.confirmDeadline);
  await go(page, `/bookings/${b.id}`);
  await shot(page, 's2-01-awaiting');
  log('--- awaiting\n', (await text(page)).slice(0, 900));
  // мастер молчит: +3 часа
  await page.clock.setSystemTime(now + 3 * 3600 * 1000);
  await page.reload();
  await hydrate(page);
  await page.waitForTimeout(1500);
  log('--- after expiry detail\n', (await text(page)).slice(0, 1500));
  await shot(page, 's2-02-expired-detail');
  const b2 = (await coreGet(page, 'bookings')).find((x) => x.id === b.id);
  log('booking after', b2.status, b2.cancelReason, JSON.stringify(b2.alternativeStarts));
  await go(page, '/memberships');
  const cl = await areaGet(page, 'client');
  log('memberships', JSON.stringify((cl?.memberships ?? []).filter((m) => m.appUserId === 'au_01').map((m) => [m.id, m.visitsLeft, m.visitsTotal])), 'used map has booking:', Boolean(cl?.membershipUsedForBooking?.[b.id]));
  await go(page, '/bookings');
  log('--- list\n', (await text(page)).slice(0, 1500));
  await shot(page, 's2-03-list');
  await go(page, '/notifications');
  log('--- notifications\n', (await text(page)).slice(0, 1500));
  await shot(page, 's2-04-notifications');
  // кнопка окна → /book c ?slot
  await go(page, `/bookings/${b.id}`);
  const alt = page.locator('[data-f="F-00-067"] a').first();
  if (await alt.count()) {
    await alt.click();
    await page.waitForURL(/\/book\?/, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);
    log('--- alt click url', page.url(), '\n', (await text(page)).slice(0, 900));
    await shot(page, 's2-05-alt-book');
  } else log('NO ALT BUTTONS');
  log('errors', errors);
} finally {
  await done();
}
