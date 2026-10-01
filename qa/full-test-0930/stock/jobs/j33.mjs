export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/stock/equipment/new');
  await p.locator('main input').first().fill('QA Фрезер');
  await p.getByRole('button', { name: 'Сохранить' }).click(); await p.waitForTimeout(800);
  log('errors1', await p.evaluate(() => [...document.querySelectorAll('main [id$=-error], main [role=alert]')].map(e=>e.innerText).filter(Boolean)));
  await p.locator('main button[aria-haspopup=dialog]').first().click(); await p.waitForTimeout(500);
  await t.shot('eq-datepicker');
  await p.locator('[role=dialog] button, [role=grid] button').filter({ hasText: /^1$/ }).first().click(); await p.waitForTimeout(500);
  log('inputs', await p.evaluate(() => [...document.querySelectorAll('main input')].map(e => (e.labels?.[0]?.innerText||'').trim()+'='+e.value)));
  log('date btn', await p.locator('main button[aria-haspopup=dialog]').first().innerText());
  log('errors2', await p.evaluate(() => [...document.querySelectorAll('main [id$=-error], main [role=alert]')].map(e=>e.innerText).filter(Boolean)));
  await p.getByRole('button', { name: 'Сохранить' }).click(); await p.waitForTimeout(3000);
  log('errors3', await p.evaluate(() => [...document.querySelectorAll('main [id$=-error], main [role=alert]')].map(e=>e.innerText).filter(Boolean)));
  log('URL', p.url());
  await t.shot('eq-after-second-save', true);
};
