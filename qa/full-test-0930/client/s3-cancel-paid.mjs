// С3: предоплата «часть» → «Я оплатил» → владелец «Деньги пришли» → клиент отменяет (до срока — возврат);
// вторая запись: оплачена, часы сдвинуты за срок бесплатной отмены → «предоплата не вернётся».
// Плюс: профиль → Telegram (демо), «Пора снова» в уведомлениях, «Горит сегодня» в каталоге (часы 10:00).
import { start, newPage, go, shot, text, coreGet, hydrate } from './h.mjs';

const STAFF = 'st_kaytsak_erik';
const { browser, done } = await start();
const log = (...a) => console.log(...a);

async function bookErik(page, dayIdx) {
  await go(page, `/book?staff=${STAFF}`);
  const radios = page.getByRole('radio');
  if (await radios.count()) {
    await radios.first().click();
    await page.getByRole('button', { name: 'Продолжить' }).first().click();
    await page.waitForTimeout(800);
  }
  const days = page.locator('button.min-w-16');
  if ((await days.count()) > dayIdx) {
    await days.nth(dayIdx).click();
    await page.waitForTimeout(600);
  }
  const slot = page.locator('button.min-h-11').filter({ hasText: /^\s*\d{1,2}:\d{2}\s*$/ }).first();
  await slot.click();
  await page.waitForTimeout(600);
  const cont = page.getByRole('button', { name: 'Продолжить' });
  if (await cont.count()) {
    await cont.first().click();
    await page.waitForTimeout(600);
  }
  await page.getByRole('button', { name: 'Подтвердить запись' }).click();
  await page.waitForTimeout(2500);
  const all = await coreGet(page, 'bookings');
  return all.filter((x) => x.staffId === STAFF && x.appUserId === 'au_01').sort((a, c) => c.createdAt.localeCompare(a.createdAt))[0];
}

async function payAndConfirm(page, b, tag) {
  await go(page, `/bookings/${b.id}`);
  await page.getByRole('button', { name: /Я оплатил/ }).click();
  await page.waitForTimeout(1500);
  // владелец барбершопа сверяет деньги
  await go(page, '/biz/online/requests', 'owner', '&sphere=barber');
  await page.waitForTimeout(1500);
  await shot(page, `s3-${tag}-owner-requests`);
  const money = page.getByRole('button', { name: 'Деньги пришли' });
  log(tag, 'money buttons', await money.count());
  if (await money.count()) {
    await money.first().click();
    await page.waitForTimeout(1500);
  }
  const b2 = (await coreGet(page, 'bookings')).find((x) => x.id === b.id);
  log(tag, 'after money', b2.status, JSON.stringify(b2.prepayment));
  return b2;
}

try {
  const now = Date.now();
  const { page, errors } = await newPage(browser, { clock: now });
  await go(page, '/');
  // --- запись 1: часть, до срока
  const b1 = await bookErik(page, 3);
  log('b1', b1.id, b1.status, b1.start, JSON.stringify(b1.prepayment));
  await payAndConfirm(page, b1, 'b1');
  await go(page, `/bookings/${b1.id}`);
  await shot(page, 's3-01-paid-detail');
  log('--- paid detail\n', (await text(page)).slice(0, 1500));
  await page.getByRole('button', { name: 'Отменить запись' }).first().click();
  await page.waitForTimeout(800);
  log('--- dialog early\n', await page.locator('[role=alertdialog],[role=dialog]').first().innerText().catch(() => 'no dialog'));
  await shot(page, 's3-02-cancel-dialog-early');
  await page.locator('[role=alertdialog],[role=dialog]').getByRole('button', { name: 'Отменить запись' }).click();
  await page.waitForTimeout(1500);
  log('--- toast/after early\n', (await page.evaluate(() => document.body.innerText)).slice(0, 1800));
  await shot(page, 's3-03-cancelled-early');
  const b1c = (await coreGet(page, 'bookings')).find((x) => x.id === b1.id);
  log('b1 cancelled', b1c.status, b1c.cancelledLate, JSON.stringify(b1c.prepayment));
  // владелец видит «Верните клиенту»?
  await go(page, `/biz/journal?date=${b1.start.slice(0, 10)}`, 'owner', '&sphere=barber');
  log('--- owner journal has Верните', (await page.evaluate(() => document.body.innerText)).includes('Верн'));

  // --- запись 2: оплачена, потом поздно
  await go(page, '/', 'client');
  const b2 = await bookErik(page, 1);
  log('b2', b2.id, b2.status, b2.start);
  await payAndConfirm(page, b2, 'b2');
  await go(page, `/bookings/${b2.id}`, 'client');
  const startMs = new Date(b2.start.length <= 16 ? b2.start + ':00+04:00' : b2.start).getTime();
  await page.clock.setSystemTime(startMs - 60 * 60 * 1000);
  await page.reload();
  await hydrate(page);
  log('--- late detail\n', (await text(page)).slice(0, 1500));
  await shot(page, 's3-04-late-detail');
  await page.getByRole('button', { name: 'Отменить запись' }).first().click();
  await page.waitForTimeout(800);
  log('--- dialog late\n', await page.locator('[role=alertdialog],[role=dialog]').first().innerText().catch(() => 'no dialog'));
  await shot(page, 's3-05-cancel-dialog-late');
  await page.locator('[role=alertdialog],[role=dialog]').getByRole('button', { name: 'Отменить запись' }).click();
  await page.waitForTimeout(1500);
  log('--- after late\n', (await page.evaluate(() => document.body.innerText)).slice(0, 1800));
  await shot(page, 's3-06-cancelled-late');
  const b2c = (await coreGet(page, 'bookings')).find((x) => x.id === b2.id);
  log('b2 cancelled', b2c.status, b2c.cancelledLate, JSON.stringify(b2c.prepayment));
  await page.clock.setSystemTime(now);

  // --- Telegram в профиле
  await go(page, '/profile', 'client');
  await page.getByText('Напоминания в Telegram').scrollIntoViewIfNeeded().catch(() => {});
  await shot(page, 's3-07-profile-telegram');
  const tg = page.getByRole('button', { name: 'Подключить Telegram' });
  log('tg button', await tg.count());
  if (await tg.count()) {
    await tg.click();
    await page.waitForTimeout(1200);
    await shot(page, 's3-08-profile-telegram-linked');
    await page.reload();
    await hydrate(page);
    log('tg after reload linked:', (await text(page)).includes('Подключено'));
  }

  // --- уведомления: «Пора снова»
  await go(page, '/notifications', 'client');
  const nt = await text(page);
  log('--- notifications\n', nt.slice(0, 2000));
  await shot(page, 's3-09-notifications');
  log('errors', errors);
} finally {
  await done();
}
