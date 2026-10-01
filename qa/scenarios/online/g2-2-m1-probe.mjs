// g2-2-m1: разведка мок-базы — ищем сидовые записи awaiting_confirmation с accessHash (для проверки
// F-00-067/F-00-068 клиентской стороны без визарда) + проверка промоблока (F-03-106) после локального фикса.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/online?persona=owner&lang=ru`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const dump = await page.evaluate(() => {
    const raw = localStorage.getItem('bp-mock-db');
    if (!raw) return { error: 'no bp-mock-db key', keys: Object.keys(localStorage) };
    const parsed = JSON.parse(raw);
    const db = parsed.state ?? parsed;
    const core = db.core ?? {};
    const online = db.areas?.online ?? {};
    const bookings = (core.bookings ?? []).filter((b) => b.status === 'awaiting_confirmation');
    const bookingMeta = online.bookingMeta ?? {};
    const withHash = bookings.filter((b) => bookingMeta[b.id]?.accessHash);
    const vardBookings = withHash.filter((b) => b.businessId === 'biz_vard').sort((a, b2) => (a.start ?? '').localeCompare(b2.start ?? ''));
    return {
      totalBookings: (core.bookings ?? []).length,
      awaitingCount: bookings.length,
      withHashCount: withHash.length,
      sample: vardBookings.slice(0, 1).map((b) => ({ id: b.id, businessId: b.businessId, hash: bookingMeta[b.id]?.accessHash, start: b.start, clientId: b.clientId })),
      businesses: (core.businesses ?? []).map((biz) => ({ id: biz.id, slug: biz.slug, status: biz.status })).slice(0, 20),
    };
  });
  console.log('DB DUMP:', JSON.stringify(dump, null, 2));

  if (dump.sample?.length) {
    const biz = dump.businesses.find((b) => b.id === dump.sample[0].businessId);
    const url = `${BASE}/b/${biz.slug}/booking/${dump.sample[0].id}?h=${dump.sample[0].hash}&persona=client&lang=ru`;
    console.log('NAVIGATING TO', url);
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    const bodyText = await page.locator('body').innerText();
    console.log('---STATUS PAGE BODY (first 1200)---');
    console.log(bodyText.slice(0, 1200));
    await page.screenshot({ path: 'qa/shots/online-g2-2/m1-booking-status-before.png', fullPage: true });

    // Мастер подтверждает ИМЕННО эту заявку (bk_1737) в той же вкладке/localStorage — проверяем, обновится
    // ли статус у клиента (F-00-067 «получает решение о заявке») и появится ли запись в истории (F-00-068).
    const bId = dump.sample[0].id;
    await page.goto(`${BASE}/biz/online/requests?persona=owner&sphere=hair&lang=ru`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    // Ищем карточку заявки, относящуюся к нашей записи, по data-booking-id либо просто по первой доступной,
    // раз мы не знаем разметку — сначала распечатаем текст экрана.
    const requestsBody = await page.locator('body').innerText();
    console.log('---REQUESTS PAGE BODY (first 800)---');
    console.log(requestsBody.slice(0, 800));
    console.log('target booking id we are tracking:', bId);
    await page.screenshot({ path: 'qa/shots/online-g2-2/m1-requests-before-confirm.png', fullPage: true });

    const confirmBtn = page.getByRole('button', { name: 'Подтвердить' }).first();
    if (await confirmBtn.count()) {
      await confirmBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: 'qa/shots/online-g2-2/m1-requests-after-confirm.png', fullPage: true });
      console.log('clicked Подтвердить on requests screen (sphere=hair)');
    } else {
      console.log('NO confirm button found on sphere=hair requests screen — cannot confirm-check this specific booking');
    }

    // Возврат на страницу клиента ТОЙ ЖЕ ЗАПИСИ — проверяем статус и историю после подтверждения (F-00-067/068).
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    const bodyText2 = await page.locator('body').innerText();
    console.log('---STATUS PAGE BODY AFTER CONFIRM (first 1000)---');
    console.log(bodyText2.slice(0, 1000));
    await page.screenshot({ path: 'qa/shots/online-g2-2/m1-booking-status-after-confirm.png', fullPage: true });
  }

  await ctx.close();
} finally {
  await browser.close();
  release();
}
