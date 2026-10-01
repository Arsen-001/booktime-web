import * as L from './lib.mjs';
await L.withBrowser(async (browser) => {
  const { page } = await L.newPage(browser, { persona: 'individual', empty: true });
  await L.go(page, '/biz/schedule'); await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Задать неделю' }).click(); await page.waitForTimeout(1200);
  const d = page.locator('main [role=dialog], body > div [role=dialog]').filter({ hasNotText: 'Hydration' }).last();
  console.log((await d.innerText().catch(() => page.innerText('main'))).replace(/\n\s*\n+/g, '\n').slice(0, 900));
  console.log((await d.evaluate((el) => [...el.querySelectorAll('button,input')].map((e) => `${e.tagName}[${e.getAttribute('role')||e.type}] ${e.getAttribute('aria-label')||e.innerText||''}`.slice(0, 70)))).join('\n'));
  await L.shot(page, 'services', 'sch-dialog');
});
