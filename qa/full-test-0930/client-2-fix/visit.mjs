// Визит: возврат остаётся в списке, личное сообщение доходит при выключенных новостях мастера, en-подписи (client-2-fix)
import { start, newPage, go, text } from '../client-2/h.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/client-2-fix';
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` });
const one = (s, n = 600) => (s ?? '').slice(0, n).replace(/\n+/g, ' | ');
const { browser, done } = await start();
try {
  const { page, errors } = await newPage(browser, { device: 'phone' });
  await go(page, '/bookings/bk_0081', 'client');
  const cb = page.getByRole('button', { name: 'Подтвердить, что приду' });
  if (await cb.count()) { await cb.click(); await page.waitForTimeout(2000); }
  const prep = await page.evaluate(() => {
    const key = 'bp-mock-db:core:bookings';
    const j = JSON.parse(localStorage.getItem(key));
    const arr = Array.isArray(j) ? j : j.state ?? j.items ?? j.data;
    const me = arr.find((b) => b.id === 'bk_0081');
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const t = arr.find((b) => b.businessId === 'biz_nuri' && String(b.start).startsWith(today) && ['scheduled', 'client_confirmed'].includes(b.status));
    if (!t) return { err: 'no today' };
    t.status = 'arrived'; t.appUserId = me?.appUserId; t.visitorName = 'Визит QA';
    localStorage.setItem(key, JSON.stringify(j));
    return { ok: t.id, staffId: t.staffId };
  });
  console.log('PREP', JSON.stringify(prep));
  await go(page, '/biz/apps/visit', 'owner');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  for (let i = 0; i < 4; i++) {
    if (await page.getByText('Визит QA').count()) break;
    const next = page.getByRole('button', { name: 'Следующая страница' });
    if (!(await next.count()) || (await next.isDisabled())) break;
    await next.click(); await page.waitForTimeout(800);
  }
  console.log('LIST', one(await text(page), 300));
  await page.getByText('Визит QA').first().click(); await page.waitForTimeout(1500);
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('tab', { name: 'Оплата' }).click(); await page.waitForTimeout(800);
  await dlg.getByLabel('Сумма').fill('1000');
  await dlg.getByRole('button', { name: /Оплатить|Принять оплату/ }).last().click(); await page.waitForTimeout(1500);
  const refund = dlg.getByRole('button', { name: 'Возврат' }).first();
  const box = await refund.boundingBox();
  console.log('refund btn size', box?.width, box?.height);
  await refund.click(); await page.waitForTimeout(1500);
  const after = await dlg.innerText();
  console.log('AFTER REFUND has возвращена:', after.includes('возвращена'), one(after, 700));
  await shot(page, 'visit-refunded-phone');
  await dlg.getByRole('button', { name: 'Написать клиенту' }).click(); await page.waitForTimeout(500);
  await dlg.getByPlaceholder('Текст сообщения…').fill('QA личное сообщение');
  await dlg.getByRole('button', { name: 'Отправить', exact: true }).click(); await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await go(page, '/profile/notifications', 'client');
  const row = page.locator('main li').filter({ hasText: 'Ани Саргсян' });
  console.log('Ани news switch (muted=false):', await row.getByRole('switch').getAttribute('aria-checked').catch(() => 'n/a'));
  await go(page, '/notifications', 'client');
  console.log('client sees direct msg while muted:', (await text(page)).includes('QA личное сообщение'));
  await shot(page, 'client-direct-msg-phone');
  // en: guest label and transliteration
  await page.goto('http://localhost:3710/biz/apps/visit?demo=owner&lang=en&theme=light&api=normal', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  const en = await text(page);
  console.log('EN visit has Cyrillic Гость:', en.includes('Гость'), one(en, 300));
  await page.goto('http://localhost:3710/biz/apps/branded?demo=owner&lang=en', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  const br = await text(page);
  const i = br.indexOf('Base price');
  console.log('EN branded prices:', one(br.slice(i, i + 250), 300), 'cyrillic?', /[а-яё]/i.test(br.slice(i, i + 250)));
  await page.locator('text=Base price').first().scrollIntoViewIfNeeded(); await shot(page, 'branded-en-phone');
  await page.goto('http://localhost:3710/?demo=client&lang=en', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const home = await text(page);
  console.log('EN home Cyrillic/Armenian left:', (home.match(/[а-яёԱ-֏]+/gi) ?? []).slice(0, 10).join(' '));
  await shot(page, 'home-en-phone');
  await page.goto('http://localhost:3710/bookings?demo=client&lang=en', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  console.log('EN bookings:', one(await text(page), 400));
  await shot(page, 'bookings-en-phone');
  console.log('ERRORS', errors.slice(0, 5));
} catch (e) { console.error('FAIL', e.message); } finally { await done(); }
