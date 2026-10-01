// №3 в браузере (мок): клиент записался к Эрику с предоплатой → «Я оплатил» → владелец «Деньги пришли» → клиент
// отменяет вовремя → владелец барбершопа видит «Вернуть предоплату» в «Требует внимания» (десктоп) / «Деньги…» (телефон)
import { start, newPage, go, coreGet } from '../../full-test-0930/client/h.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/queue-1001b/bugs';
const STAFF = 'st_kaytsak_erik';
const { browser, done } = await start();
const log = (...a) => console.log(...a);
try {
  const { page } = await newPage(browser, { device: 'desktop' });
  await go(page, `/book?staff=${STAFF}`);
  const radios = page.getByRole('radio');
  if (await radios.count()) { await radios.first().click(); await page.getByRole('button', { name: 'Продолжить' }).first().click(); await page.waitForTimeout(800); }
  const days = page.locator('button.min-w-16');
  if ((await days.count()) > 3) { await days.nth(3).click(); await page.waitForTimeout(600); }
  await page.locator('button.min-h-11').filter({ hasText: /^\s*\d{1,2}:\d{2}\s*$/ }).first().click();
  await page.waitForTimeout(600);
  const cont = page.getByRole('button', { name: 'Продолжить' });
  if (await cont.count()) { await cont.first().click(); await page.waitForTimeout(600); }
  await page.getByRole('button', { name: 'Подтвердить запись' }).click();
  await page.waitForTimeout(2500);
  const b = (await coreGet(page, 'bookings')).filter((x) => x.staffId === STAFF && x.appUserId === 'au_01').sort((a, c) => c.createdAt.localeCompare(a.createdAt))[0];
  log('запись', b.id, b.start, b.status, JSON.stringify(b.prepayment));
  await go(page, `/bookings/${b.id}`);
  await page.getByRole('button', { name: /Я оплатил/ }).click();
  await page.waitForTimeout(1500);
  await go(page, '/biz/online/requests', 'owner', '&sphere=barber');
  await page.getByRole('button', { name: 'Деньги пришли' }).first().click();
  await page.waitForTimeout(1500);
  log('после «Деньги пришли»', JSON.stringify((await coreGet(page, 'bookings')).find((x) => x.id === b.id).prepayment));
  await go(page, `/bookings/${b.id}`, 'client');
  await page.getByRole('button', { name: 'Отменить запись' }).first().click();
  await page.waitForTimeout(800);
  await page.locator('[role=alertdialog],[role=dialog]').getByRole('button', { name: 'Отменить запись' }).click();
  await page.waitForTimeout(1500);
  const c = (await coreGet(page, 'bookings')).find((x) => x.id === b.id);
  log('после отмены', c.status, c.cancelledLate, JSON.stringify(c.prepayment));
  for (const [device, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    await page.setViewportSize(vp);
    await go(page, '/biz/journal', 'owner', '&sphere=barber');
    await page.getByText(/Вернуть предоплату|Деньги: оплата и возвраты/).first().waitFor({ timeout: 30000 }).catch(() => {});
    const body = await page.locator('body').innerText();
    log(device, 'журнал:', (body.match(/Вернуть предоплату[^\n]*|Деньги: оплата и возвраты/) ?? ['нет'])[0], '|', (body.match(/Верните клиенту[^\n]*/) ?? [''])[0]);
    await page.screenshot({ path: `${OUT}/n3-journal-${device}.png` });
    if (device === 'phone') {
      await page.getByText('Деньги: оплата и возвраты').first().click().catch(() => {});
      await page.waitForTimeout(1500);
      log('phone после нажатия:', ((await page.locator('body').innerText()).match(/Вернуть предоплату[^\n]*/) ?? ['нет'])[0]);
      await page.screenshot({ path: `${OUT}/n3-journal-phone-open.png` });
    }
  }
} finally {
  await done();
}
