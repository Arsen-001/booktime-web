export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/stock/equipment/new');
  await p.locator('main input').first().fill('QA Лампа UV');
  await p.locator('main button[aria-haspopup=dialog]').first().click(); await p.waitForTimeout(500);
  await p.locator('[role=dialog] button, [role=grid] button').filter({ hasText: /^1$/ }).first().click(); await p.waitForTimeout(300);
  await p.getByLabel(/Обслуживание раз в/).fill('3');
  log('inputs', await p.evaluate(() => [...document.querySelectorAll('main input')].map(e => (e.labels?.[0]?.innerText||'').trim()+'='+e.value)));
  await p.getByRole('button', { name: 'Сохранить' }).click(); await p.waitForTimeout(3000);
  log('errors', await p.evaluate(() => [...document.querySelectorAll('main [id$=-error], main [role=alert]')].map(e=>e.innerText).filter(Boolean)));
  log('toasts', await p.evaluate(() => [...document.querySelectorAll('[data-sonner-toast], [role=status], [data-toast]')].map(e=>e.innerText)));
  log('URL', p.url());
  await t.shot('equipment-save-attempt', true);
};
