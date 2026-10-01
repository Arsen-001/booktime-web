// «Быстрый старт» по ролям + пробный период в пустом бизнесе
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/settings/flow3';
export async function run(browser) {
  for (const [persona, empty] of [['master', 0], ['admin', 0], ['owner', 0], ['individual', 1]]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); page.setDefaultNavigationTimeout(400000);
    await page.goto(`${BASE}/biz/settings?demo=${persona}&lang=ru&empty=${empty}`); await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}/gate-${persona}-hub.png` });
    const hub = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
    console.log(`[gate ${persona}] hub: banner=${/Осталось|Пробный период/.test(hub)} profile=${hub.includes('Заполните профиль')} company=${hub.includes('Бренд')} account=${hub.includes('Личный кабинет')}`);
    const nav = await page.locator('nav, aside').allInnerTexts().catch(() => []);
    for (const r of ['/biz/onboarding', '/biz/onboarding/quick-start', '/biz/onboarding/invite/demo', '/biz/onboarding/restore']) {
      await page.goto(BASE + r); await page.waitForTimeout(3000);
      const t = (await page.locator('main').innerText().catch(() => (page.locator('body').innerText()))).replace(/\s+/g, ' ');
      console.log(`[gate ${persona}] ${r}: denied=${t.includes('Нет прав')} | ${t.slice(0, 120)}`);
    }
    if (persona === 'individual') {
      await page.goto(`${BASE}/biz/billing`); await page.waitForTimeout(3000);
      await page.screenshot({ path: `${OUT}/gate-individual-empty-billing.png` });
      console.log('[gate individual-empty] billing:', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 300));
    }
    await ctx.close();
  }
}
