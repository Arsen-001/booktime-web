// F-00-024: замороженная подписка (demo biz_davit, sub.frozen) — виден ли клиентам?
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/settings/actions';
export async function run(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); page.setDefaultNavigationTimeout(150000); page.setDefaultTimeout(60000);
  await page.goto(`${BASE}/?demo=guest&lang=ru&empty=0`); await page.waitForTimeout(1500);
  await page.goto(`${BASE}/b/davit-carwash`); await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/frozen-public.png` });
  console.log('[frozen] public page:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300));
  await page.goto(`${BASE}/search?sphere=carwash`); await page.waitForTimeout(3000);
  const t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  console.log('[frozen] search carwash contains Давид:', t.includes('Давид'), t.slice(0, 300));
  // Владелец davit (carwash индивидуал) видит плашку заморозки
  await page.goto(`${BASE}/biz/billing?demo=individual&sphere=carwash&empty=0`); await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/frozen-billing.png` });
  console.log('[frozen] billing individual carwash:', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 400));
  await ctx.close();
}
