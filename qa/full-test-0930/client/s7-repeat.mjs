// С7: «Пора снова» (F-00-119): последний визит к Ани старше интервала услуги и новой записи нет → уведомление
import { start, newPage, go, shot, text, hydrate, coreGet } from './h.mjs';

const { browser, done } = await start();
const log = (...a) => console.log(...a);
try {
  const { page, ctx } = await newPage(browser);
  await go(page, '/bookings');
  // отменяем будущую запись к Ани (иначе «уже записалась снова»)
  const card = page.locator('a[href^="/bookings/bk"]', { hasText: 'Ани Саргсян' }).first();
  const href = await card.getAttribute('href');
  await go(page, href);
  await page.getByRole('button', { name: 'Отменить запись' }).first().click();
  await page.waitForTimeout(800);
  await page.locator('[role=alertdialog],[role=dialog]').getByRole('button', { name: 'Отменить запись' }).click();
  await page.waitForTimeout(2500);
  await go(page, '/notifications');
  log('before shift, Пора снова:', (await text(page)).includes('Пора снова'));
  const res = await page.evaluate(() => {
    const k = 'bp-mock-db:core:bookings';
    const arr = JSON.parse(localStorage.getItem(k));
    if (!arr) return 'no key';
    const past = arr.filter((b) => b.appUserId === 'au_01' && b.staffId === 'st_nuri_ani' && b.status === 'arrived');
    for (const b of past) {
      const d = new Date(b.start + ':00Z');
      d.setUTCDate(d.getUTCDate() - 25);
      b.start = d.toISOString().slice(0, 16);
    }
    localStorage.setItem(k, JSON.stringify(arr));
    return past.map((b) => b.start);
  });
  log('shifted', JSON.stringify(res));
  await page.reload();
  await hydrate(page);
  const t = await text(page);
  log('after shift, Пора снова:', t.includes('Пора снова'));
  log(t.slice(0, 600));
  await shot(page, 's7-repeat-notification');
  const btn = page.locator('[data-f="F-00-119"]').first();
  if (await btn.count()) {
    await btn.click();
    await page.waitForURL(/\/book\?/, { timeout: 120000 }).catch(() => {});
    log('book url:', page.url());
  }
  await go(page, '/');
  log('home repeat card:', (await text(page)).slice(0, 500));
  await shot(page, 's7-home-repeat');
  await ctx.close();
} finally {
  await done();
}
