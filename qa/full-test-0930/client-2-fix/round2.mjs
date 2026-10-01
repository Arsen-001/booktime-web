// Второй заход (01.10): 12 ч в журнале и у клиента, места события без «Гость +1», напоминания по языку, новый сотрудник, сторис мастера
import { start, newPage, go, text } from '../client-2/h.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/client-2-fix';
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` });
const one = (s, n = 400) => (s ?? '').slice(0, n).replace(/\n+/g, ' | ');
const { browser, done } = await start();
const log = (...a) => console.log(...a);
try {
  const { page, errors } = await newPage(browser, { device: 'phone' });
  // 12 ч у клиента
  await go(page, '/profile', 'client');
  await page.getByText('12 часов (AM/PM)').first().click(); await page.waitForTimeout(1500);
  await go(page, '/bookings', 'client');
  const bt = await text(page);
  log('client 12h:', (bt.match(/\d{1,2}:\d{2}( [AP]M)?/g) ?? []).slice(0, 4).join(', '), '| вечера:', /вечера|утра/.test(bt));
  await shot(page, 'r2-client-12h-phone');
  // 12 ч в журнале — переключатель журнала
  const { page: pj } = await newPage(browser, { device: 'desktop' });
  await go(pj, '/biz/journal', 'owner');
  const hf = await pj.evaluate(() => Object.keys(localStorage).filter((k) => /hour|time.?format/i.test(k)));
  log('journal hour keys:', hf.join(','));
  const jt0 = await text(pj);
  log('journal times sample:', (jt0.match(/\d{1,2}:\d{2}( [AP]M)?/g) ?? []).slice(0, 4).join(', '));
  // Событие: 3 места
  await go(page, '/biz/apps/events', 'owner', '&sphere=fitness');
  if (!(await page.locator('main ul li').count())) {
    await page.getByRole('button', { name: 'Новое событие' }).first().click(); await page.waitForTimeout(1000);
    const cd = page.getByRole('dialog'); const combos = cd.getByRole('combobox');
    for (let i = 0; i < 2; i++) { await combos.nth(i).click(); await page.waitForTimeout(400); await page.getByRole('option').first().click(); await page.waitForTimeout(400); }
    await cd.getByRole('button', { name: 'Новое событие' }).last().click(); await page.waitForTimeout(2000);
  }
  await page.locator('main ul li').first().click(); await page.waitForTimeout(1200);
  let d = page.getByRole('dialog');
  await d.getByLabel('Имя').last().fill('Анна QA');
  await d.getByLabel('Мест').fill('3');
  await d.getByRole('button', { name: 'Записать', exact: true }).click(); await page.waitForTimeout(2500);
  const stored = await page.evaluate(() => {
    const j = JSON.parse(localStorage.getItem('bp-mock-db:core:bookings'));
    const arr = Array.isArray(j) ? j : j.state ?? j.items ?? j.data;
    return arr.filter((b) => b.groupEventId).map((b) => b.visitorName).slice(-3);
  });
  log('stored names:', JSON.stringify(stored));
  log('dialog participants:', one(await d.innerText(), 500));
  await shot(page, 'r2-event-seats-phone');
  await page.keyboard.press('Escape');
  // Напоминания en
  await page.goto('http://localhost:3710/biz/apps/reminders?demo=owner&lang=en', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
  const rt = await text(page);
  log('reminders en cyrillic words:', (rt.match(/[а-яё]{3,}/gi) ?? []).slice(0, 6).join(' '), '|', one(rt, 250));
  await shot(page, 'r2-reminders-en-phone');
  // Новый сотрудник
  await go(page, '/biz/apps/team', 'owner');
  await page.getByRole('button', { name: 'Добавить сотрудника' }).first().click(); await page.waitForTimeout(800);
  d = page.getByRole('dialog');
  await d.getByLabel('Имя').fill('Новый QA');
  await d.getByLabel('Телефон').fill('99123456');
  await d.getByRole('button', { name: 'Создать' }).click(); await page.waitForTimeout(2500);
  log('after create dialog:', one(await page.getByRole('dialog').innerText().catch(() => 'no dialog'), 150));
  await shot(page, 'r2-team-created-phone');
  await page.keyboard.press('Escape'); await page.waitForTimeout(800);
  log('first row:', one(await page.locator('main li').first().innerText(), 80));
  // Сторис мастера
  await go(page, '/biz/apps/stories', 'master');
  const st = await text(page);
  log('master stories page:', one(st, 300), '| staff chips label:', st.includes('Мастера'));
  await page.getByRole('button', { name: /Сгенерировать|Создать сторис/ }).first().click().catch((e) => log('gen', e.message.split('\n')[0]));
  await page.waitForTimeout(2000);
  const pub = page.getByRole('button', { name: /Опубликовать/ }).first();
  if (await pub.count()) { await pub.click(); await page.waitForTimeout(2500); }
  log('master after publish:', one(await text(page), 600));
  await shot(page, 'r2-stories-master-phone');
  await go(page, '/biz/apps/stories', 'owner');
  const ot = await text(page);
  log('owner sees master story (от …):', /от [А-Я]/.test(ot), '| delete buttons:', await page.getByRole('button', { name: 'Снять сторис' }).count());
  const del = page.getByRole('button', { name: 'Снять сторис' }).first();
  if (await del.count()) {
    const before = await del.count();
    await del.click(); await page.waitForTimeout(600);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Снять сторис' }).click(); await page.waitForTimeout(1500);
    log('owner delete: before', before, 'after', await page.getByRole('button', { name: 'Снять сторис' }).count());
  }
  await shot(page, 'r2-stories-owner-phone');
  log('ERRORS', errors.filter((e) => !/favicon/.test(e)).slice(0, 5));
} catch (e) { console.error('FAIL', e.message); } finally { await done(); }
