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
  // --- утро сегодняшнего дня: горящие окна «Сегодня»
  const d = new Date();
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yerevan' }).format(d);
  const morning = new Date(`${ymd}T09:00:00+04:00`).getTime();
  const m = await newPage(browser, { clock: morning });
  await step('hot today', async () => {
    await go(m.page, '/search?free=today');
    await m.page.waitForTimeout(1500);
    const t = await text(m.page);
    log('--- search free=today (09:00)\n', t.slice(0, 900));
    log('hot badges:', (t.match(/Горит сегодня/g) ?? []).length);
    await shot(m.page, 's4-01-search-today');
    await go(m.page, '/');
    log('--- home 09:00\n', (await text(m.page)).slice(0, 700));
    await shot(m.page, 's4-02-home-morning');
  });
  await m.ctx.close();

  const { page, errors, ctx } = await newPage(browser);
  await step('search', async () => {
    await go(page, '/search');
    const input = page.getByRole('searchbox').or(page.locator('input[type=search], input[placeholder]')).first();
    await input.fill('маникюр');
    await page.waitForTimeout(1500);
    log('--- search маникюр\n', (await text(page)).slice(0, 500));
    await input.fill('zzzqqq');
    await page.waitForTimeout(1500);
    log('--- search zzz\n', (await text(page)).slice(0, 500));
    await shot(page, 's4-03-search-empty');
    const reset = page.getByRole('button', { name: /Сбросить/ });
    log('reset buttons', await reset.count());
  });
  await step('favorite', async () => {
    await go(page, '/masters/st_kaytsak_erik');
    await shot(page, 's4-04-master');
    log('--- master\n', (await text(page)).slice(0, 900));
    const fav = page.getByRole('button', { name: /избранн|Подписаться|Следить/i }).first();
    log('fav btn:', await fav.getAttribute('aria-label').catch(() => null), await fav.innerText().catch(() => ''));
    await fav.click();
    await page.waitForTimeout(1200);
    await go(page, '/favorites');
    const t = await text(page);
    log('favorites has Эрик:', t.includes('Эрик'));
    await shot(page, 's4-05-favorites');
  });
  await step('reschedule', async () => {
    await go(page, '/bookings');
    const card = page.locator('a[href^="/bookings/bk"]').first();
    const href = await card.getAttribute('href');
    const id = href.split('/').pop();
    const before = (await coreGet(page, 'bookings')).find?.((b) => b.id === id);
    await go(page, `${href}/reschedule`);
    log('--- reschedule\n', (await text(page)).slice(0, 600));
    await shot(page, 's4-06-reschedule');
    const slot = page.locator('button.min-h-11').filter({ hasText: /^\s*\d{1,2}:\d{2}\s*$/ }).nth(1);
    await slot.click();
    await page.waitForTimeout(500);
    const btn = page.getByRole('button', { name: /Перенести|Сохранить|Подтвердить/ }).last();
    await btn.click();
    await page.waitForTimeout(2000);
    const after = (await coreGet(page, 'bookings')).find((b) => b.id === id);
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
