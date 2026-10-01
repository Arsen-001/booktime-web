// Проверка действием: колокольчик панели, «первый», карточка мастера + жалоба, поиск «стрижка», звёзды отчётов, PeriodNav
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/leftovers';
const only = process.argv[2]?.split(',');
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = (...a) => console.log(...a);
async function ctxFor(device) {
  const ctx = await browser.newContext(device === 'phone'
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => page.errors.push('pageerror ' + e.message.slice(0, 300)));
  return { ctx, page };
}
const go = async (page, path, persona) => {
  await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}demo=${persona}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForTimeout(5000);
};
const want = (k) => !only || only.includes(k);
try {
  for (const device of ['desktop', 'phone']) {
    const { ctx, page } = await ctxFor(device);
    if (want('bell')) {
      await go(page, '/platform', 'platform');
      await page.getByRole('button', { name: 'Уведомления' }).first().click();
      await page.waitForTimeout(1500);
      const txt = await page.getByText('Новых уведомлений нет').count();
      log(device, 'bell empty state:', txt > 0 ? 'OK' : 'NO');
      await page.screenshot({ path: `${OUT}/v1-bell-${device}.png` });
      await page.keyboard.press('Escape');
    }
    if (want('first')) {
      await go(page, '/places/biz_manana_nn', 'client');
      log(device, 'place first badge:', (await page.getByText('Первый в районе').count()) > 0 ? 'OK' : 'NO');
      await page.screenshot({ path: `${OUT}/v1-place-first-${device}.png` });
    }
    if (want('master')) {
      await go(page, '/masters/st_manana_arpi', 'client');
      log(device, 'master first badge:', (await page.getByText('Первый в районе').count()) > 0 ? 'OK' : 'NO');
      const rep = page.getByRole('button', { name: 'Пожаловаться' });
      log(device, 'report button:', await rep.count());
      await rep.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/v1-master-${device}.png`, fullPage: true });
      if (device === 'desktop') {
        await rep.click();
        await page.waitForTimeout(800);
        await page.getByText('Неверные сведения').click();
        await page.getByPlaceholder('Что не так — необязательно').fill('QA 01.10: проверка жалобы');
        await page.screenshot({ path: `${OUT}/v1-report-modal-${device}.png` });
        await page.getByRole('button', { name: 'Отправить жалобу' }).click();
        await page.waitForTimeout(1500);
        log(device, 'report toast:', (await page.getByText('Жалоба отправлена').count()) > 0 ? 'OK' : 'NO');
        await go(page, '/platform/moderation', 'platform');
        const hit = await page.getByText('QA 01.10: проверка жалобы', { exact: false }).count();
        log(device, 'complaint in moderation queue:', hit > 0 ? 'OK' : 'NO');
        await page.screenshot({ path: `${OUT}/v1-moderation-${device}.png` });
      }
    }
    if (want('search')) {
      await go(page, '/search?q=' + encodeURIComponent('стрижка'), 'client');
      const body = await page.locator('main').innerText().catch(() => '');
      log(device, 'search стрижка: has Укладка', /Укладка/.test(body), '| has Стрижк', /Стрижк|стрижк/.test(body));
      await page.screenshot({ path: `${OUT}/v1-search-${device}.png` });
    }
    if (want('stars')) {
      await go(page, '/biz/reports/r/reviews', 'owner');
      const color = await page.locator('svg.lucide-star.text-warning').first().evaluate((el) => getComputedStyle(el).color + ' / ' + getComputedStyle(el).fill + ' / count ' + document.querySelectorAll('svg.lucide-star.text-warning').length).catch((e) => 'none ' + e.message.slice(0, 80));
      log(device, 'reviews star color:', color);
      await page.screenshot({ path: `${OUT}/v1-reviews-${device}.png` });
    }
    if (want('period')) {
      await go(page, '/biz/schedule', 'owner');
      const nav = page.locator('button:has(svg.lucide-calendar-days)').first();
      const box = await nav.boundingBox();
      log(device, 'period label:', (await nav.innerText()).replace(/\n/g, ' '), JSON.stringify(box));
      await page.screenshot({ path: `${OUT}/v1-schedule-${device}.png` });
    }
    log(device, 'console errors:', page.errors.length, page.errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
  release();
}
