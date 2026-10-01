// F-15-069/099: мастер и администратор — доступ к подписке, монетам и настройкам
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/settings/actions';
export async function run(browser) {
  for (const persona of ['master', 'admin']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); page.setDefaultNavigationTimeout(150000); page.setDefaultTimeout(60000);
    await page.goto(`${BASE}/biz/onboarding?demo=${persona}&lang=ru&empty=0`); await page.waitForTimeout(1500);
    for (const r of ['/biz/billing', '/biz/coins', '/biz/settings', '/biz/settings/contacts', '/biz/settings/legal', '/biz/onboarding', '/biz/settings/account']) {
      await page.goto(BASE + r); await page.waitForTimeout(2000);
      await page.screenshot({ path: `${OUT}/role-${persona}${r.replace(/\//g, '_')}.png` });
      console.log(`[role ${persona}] ${r}:`, (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 220));
    }
    await ctx.close();
  }
}
