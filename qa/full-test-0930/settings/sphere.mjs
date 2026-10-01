// F-00-151: «Моей сферы нет» — заявка владельца видна в нашей панели; F-15-029 смена сферы
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/settings/actions';
export async function run(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); page.setDefaultNavigationTimeout(150000); page.setDefaultTimeout(60000);
  const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 150)));
  await page.goto(`${BASE}/biz/onboarding?demo=owner&lang=ru&empty=0`); await page.waitForTimeout(1500);
  await page.goto(`${BASE}/biz/onboarding/sphere-request`); await page.waitForTimeout(2500);
  await page.getByPlaceholder('Например, «Тату-студия»').fill('Тату QA-сфера');
  await page.getByRole('button', { name: 'Отправить заявку' }).click(); await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/sphere-request-sent.png` });
  console.log('[sphere] after send:', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 400));
  await page.goto(`${BASE}/platform/sphere-requests?demo=platform`); await page.waitForTimeout(3000);
  const t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  await page.screenshot({ path: `${OUT}/sphere-request-platform.png` });
  console.log('[sphere] platform sees request:', t.includes('Тату QA-сфера'));
  // смена сферы в настройках
  await page.goto(`${BASE}/biz/settings/sphere?demo=owner`); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/sphere-settings.png` });
  console.log('[sphere] settings sphere:', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 500));
  console.log('[sphere] errors', errs);
  await ctx.close();
}
