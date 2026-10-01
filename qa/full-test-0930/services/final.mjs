import * as L from './lib.mjs';
await L.withBrowser(async (browser) => {
  const { page } = await L.newPage(browser, { persona: 'platform' });
  await L.go(page, '/platform/moderation'); await page.waitForTimeout(1500);
  const row = page.locator('tr', { hasText: 'Фото мастера · Ани Саргсян' });
  await row.getByRole('button', { name: 'Отклонить — выбрать причину' }).click(); await page.waitForTimeout(600);
  await page.getByText('Плохое качество фото').click(); await page.waitForTimeout(1500);
  await L.as(page, 'owner');
  await L.go(page, '/biz/services/photos'); await page.waitForTimeout(2500);
  const t = await page.innerText('main');
  console.log('reason line:', t.match(/Причина:[^\n]*/)?.[0]);
  await L.shot(page, 'services', 'ph03-reject-reason-fixed');
  console.log('ERR', page.errors.filter(e=>!e.includes('WebSocket')));
  // phone shots
  const { page: ph } = await L.newPage(browser, { persona: 'owner', device: 'phone' });
  for (const r of ['/biz/services', '/biz/services/photos']) { await L.go(ph, r); await ph.waitForTimeout(1500); await L.shot(ph, 'services', 'phone' + r.replace(/\W+/g, '_')); console.log(r, 'overflow', await ph.evaluate(() => document.documentElement.scrollWidth > innerWidth), ph.errors.splice(0).filter(e=>!e.includes('WebSocket'))); }
  const { page: pp } = await L.newPage(browser, { persona: 'platform', device: 'phone' });
  for (const r of ['/platform/moderation', '/platform/visits']) { await L.go(pp, r); await pp.waitForTimeout(1500); await L.shot(pp, 'platform', 'phone' + r.replace(/\W+/g, '_')); console.log(r, 'overflow', await pp.evaluate(() => document.documentElement.scrollWidth > innerWidth), pp.errors.splice(0).filter(e=>!e.includes('WebSocket'))); }
});
