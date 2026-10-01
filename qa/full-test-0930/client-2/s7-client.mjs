// Клиентская сторона второй половины: F-14-057…068, 070, 081, 136, 163, 165
import { start, newPage, go, shot, text, coreGet } from './h.mjs';

const { browser, done } = await start();
const log = (...a) => console.log(...a);
const one = (s, n = 600) => s.slice(0, n).replace(/\n+/g, ' | ');
try {
  const { page, errors } = await newPage(browser, { device: 'phone' });

  // F-14-057 подтверждение записи клиентом
  await go(page, '/bookings', 'client');
  await shot(page, 'c-bookings');
  log('BOOKINGS:', one(await text(page), 800));
  const links = page.locator('main a[href^="/bookings/"]');
  const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  log('booking links:', hrefs.length);
  let confirmedId = null;
  for (const h of [...new Set(hrefs)].filter((h) => !h.includes('reschedule')).slice(0, 8)) {
    await go(page, h, 'client');
    const btn = page.getByRole('button', { name: 'Подтвердить, что приду' });
    if (await btn.count()) {
      await shot(page, 'c-booking-confirm-before');
      await btn.click();
      await page.waitForTimeout(1500);
      await shot(page, 'c-booking-confirm-after');
      log('after confirm, button gone:', (await btn.count()) === 0, one(await text(page), 400));
      confirmedId = h.split('/').pop();
      break;
    }
  }
  log('confirmedId', confirmedId);
  if (confirmedId) {
    const bookings = await coreGet(page, 'bookings');
    const arr = Array.isArray(bookings) ? bookings : bookings?.items ?? Object.values(bookings ?? {});
    const b = (Array.isArray(arr) ? arr : []).find?.((x) => x.id === confirmedId);
    log('core status of confirmed booking:', b?.status, b ? '' : 'not found; keys=' + JSON.stringify(Object.keys(bookings ?? {})).slice(0, 200));
    await page.reload();
    await page.waitForTimeout(2000);
    log('after reload confirm button present:', await page.getByRole('button', { name: 'Подтвердить, что приду' }).count());
  }

  // Профиль: имя, формат времени, язык, крупный шрифт
  await go(page, '/profile', 'client');
  await shot(page, 'c-profile');
  log('PROFILE:', one(await text(page), 700));
  await page.getByRole('button', { name: 'Изменить имя' }).click();
  await page.waitForTimeout(600);
  const dlg = page.getByRole('dialog');
  const nameInput = dlg.getByLabel('Имя');
  await nameInput.fill('');
  await dlg.getByRole('button').last().click().catch(() => {});
  await page.waitForTimeout(600);
  log('empty-name dialog still open:', await dlg.count(), one(await dlg.innerText().catch(() => ''), 200));
  await nameInput.fill('Ани QA').catch(() => {});
  await dlg.getByRole('button', { name: /Сохранить/ }).click().catch((e) => log('no save', e.message));
  await page.waitForTimeout(1200);
  log('name updated on page:', (await text(page)).includes('Ани QA'));

  await page.getByRole('radio', { name: '12 часов (AM/PM)' }).click().catch(async () => page.getByText('12 часов (AM/PM)').click());
  await page.waitForTimeout(1000);
  await go(page, '/bookings', 'client');
  const bt = await text(page);
  log('12h in bookings:', /\b(AM|PM)\b/.test(bt), one(bt, 300));
  await shot(page, 'c-bookings-12h');
  await go(page, '/profile', 'client');
  await page.getByText('24 часа').click();
  await page.waitForTimeout(800);

  // Крупный шрифт
  const fsBefore = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  await page.getByRole('switch', { name: /Крупный шрифт/ }).click();
  await page.waitForTimeout(1200);
  const fsAfter = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  log('font size root', fsBefore, '->', fsAfter);
  await shot(page, 'c-profile-largefont');
  await go(page, '/', 'client');
  await shot(page, 'c-home-largefont');
  const hs = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  log('home overflow px with large font:', hs);
  await go(page, '/profile', 'client');
  await page.getByRole('switch', { name: /Крупный шрифт/ }).click();
  await page.waitForTimeout(800);

  // Язык → en → обратно
  await page.getByRole('radio', { name: /English|EN/i }).first().click().catch((e) => log('lang en', e.message));
  await page.waitForTimeout(1500);
  log('EN profile:', one(await text(page), 300));
  await shot(page, 'c-profile-en');
  await page.getByRole('radio', { name: /Русский|RU/i }).first().click().catch((e) => log('lang ru', e.message));
  await page.waitForTimeout(1500);

  // Удаление аккаунта — отмена
  await page.getByRole('button', { name: 'Удалить аккаунт' }).click();
  await page.waitForTimeout(500);
  await shot(page, 'c-delete-dialog');
  await page.getByRole('button', { name: 'Оставить' }).click();
  await page.waitForTimeout(500);

  // Настройки уведомлений
  await go(page, '/profile/notifications', 'client');
  await shot(page, 'c-notif-settings');
  const ns = await text(page);
  log('NOTIF SETTINGS:', one(ns, 800));
  const sw = page.locator('main [role="switch"]');
  const nsw = await sw.count();
  log('switches:', nsw);
  const states0 = await sw.evaluateAll((els) => els.map((e) => e.getAttribute('aria-checked')));
  if (nsw > 1) {
    await sw.nth(0).click();
    await sw.nth(1).click();
    await page.waitForTimeout(1500);
    await page.reload();
    await page.waitForTimeout(2500);
    const states1 = await sw.evaluateAll((els) => els.map((e) => e.getAttribute('aria-checked')));
    log('switch states before', states0, 'after reload', states1);
  }

  // Лента уведомлений
  await go(page, '/notifications', 'client');
  await shot(page, 'c-notifications');
  log('NOTIFS:', one(await text(page), 900));

  // Вход (F-14-068)
  await go(page, '/login', 'guest');
  await shot(page, 'c-login');
  log('LOGIN:', one(await text(page), 600));

  // Регистрация бизнеса (F-14-081)
  await go(page, '/register-business', 'client');
  await shot(page, 'c-register-business');
  log('REGBIZ:', one(await text(page), 600));

  log('ERRORS:', errors.slice(0, 10));
} catch (e) {
  console.error('FAIL', e);
} finally {
  await done();
}
