// Телефон: подборка и карточка
export default async ({ page, go, shot, text }) => {
  await go('/biz/clients', { device: 'phone' });
  await shot('s03-list-phone');
  await page.getByRole('button', { name: /Пора записать/ }).first().click();
  await page.waitForTimeout(1500);
  await shot('s03-due-phone');
  const t1 = (await text()).slice(0, 1200);
  const first = page.locator('a[href^="/biz/clients/c"], a[href^="/biz/clients/"]').filter({ hasNot: page.locator('nav') });
  const hrefs = await page.locator('main a[href^="/biz/clients/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  const cardHref = hrefs.find((h) => /^\/biz\/clients\/[^/]+$/.test(h) && !/categories|import|summary|log|consent|loyalty|integrations/.test(h));
  if (cardHref) { await go(cardHref, { device: 'phone' }); await shot('s03-due-card-phone'); }
  // размеры кнопок
  const small = await page.evaluate(() => [...document.querySelectorAll('main button, main a')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 40 || r.width < 40); }).map((e) => `${e.innerText.trim().slice(0, 30) || e.getAttribute('aria-label')} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  return { t1, cardHref, small: small.slice(0, 20), overflow, card: (await text()).slice(0, 800) };
};
