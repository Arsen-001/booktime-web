// С1: запись с предоплатой (часть / вся сумма), «Я оплатил» → ждём мастера, отмена оплаченной
import { start, newPage, go, shot, text, coreGet, hydrate } from './h.mjs';

const { browser, done } = await start();
const log = (...a) => console.log(...a);
try {
  const { page, errors } = await newPage(browser);
  await go(page, '/');
  await go(page, '/book?staff=st_kaytsak_erik');
  log('--- step1\n', (await text(page)).slice(0, 800));
  await shot(page, 's1-01-service');
  const radios = page.getByRole('radio');
  if (await radios.count()) {
    await radios.first().click();
    await page.getByRole('button', { name: 'Продолжить' }).first().click();
    await page.waitForTimeout(800);
  }
  log('--- step time\n', (await text(page)).slice(0, 600));
  await shot(page, 's1-02-time');
  const slot = page.locator('button.min-h-11').filter({ hasText: /^\s*\d{1,2}:\d{2}\s*$/ }).first();
  log('slot:', await slot.innerText());
  await slot.click();
  await page.waitForTimeout(800);
  const cont = page.getByRole('button', { name: 'Продолжить' });
  if (await cont.count()) {
    await cont.first().click();
    await page.waitForTimeout(800);
  }
  log('--- confirm step\n', (await text(page)).slice(0, 1500));
  await shot(page, 's1-03-confirm');
  const full = page.getByRole('radio', { name: /Всю сумму|всю сумму/ });
  log('full radio count', await full.count());
  if ((process.env.S1_MODE ?? 'full') === 'full' && (await full.count())) await full.first().click();
  await page.waitForTimeout(300);
  await shot(page, 's1-04-choice');
  await page.getByRole('button', { name: 'Подтвердить запись' }).click();
  await page.waitForTimeout(2500);
  log('--- done\n', page.url(), '\n', (await text(page)).slice(0, 1200));
  await shot(page, 's1-05-done');
  const bookings = await coreGet(page, 'bookings');
  const arr = Array.isArray(bookings) ? bookings : bookings?.items ?? [];
  const mine = arr.filter((b) => b.staffId === 'st_kaytsak_erik' && b.appUserId === 'au_01').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  log('booking', JSON.stringify(mine));
  if (mine) {
    await go(page, `/bookings/${mine.id}`);
    log('--- detail\n', (await text(page)).slice(0, 1500));
    await shot(page, 's1-06-detail');
    const paid = page.getByRole('button', { name: /Я оплатил/ });
    if (await paid.count()) {
      await paid.click();
      await page.waitForTimeout(1500);
      await shot(page, 's1-07-reported');
      log('--- after paid\n', (await text(page)).slice(0, 1500));
      await page.reload();
      await hydrate(page);
      log('--- reload\n', (await text(page)).slice(0, 1500));
      await shot(page, 's1-08-reload');
      const b2 = (await coreGet(page, 'bookings')).find?.((b) => b.id === mine.id);
      log('booking after', JSON.stringify(b2?.status), JSON.stringify(b2?.prepayment));
    }
    // список «Мои записи»
    await go(page, '/bookings');
    log('--- list\n', (await text(page)).slice(0, 1200));
    await shot(page, 's1-09-list');
  }
  log('errors', errors);
} finally {
  await done();
}
