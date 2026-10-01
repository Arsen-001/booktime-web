const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/stock/settings');
  log('owner settings:', norm(await t.text()).slice(0, 60).replace(/\n/g,' | '));
  // 5. колокольчик
  const bellBtn = p.getByRole('button', { name: 'Уведомления' }).first();
  log('bell badge:', await p.locator('[data-f="F-01-007"] span[aria-hidden]').allInnerTexts());
  await bellBtn.click(); await p.waitForTimeout(1500);
  const pop = p.locator('[data-f="F-00-137"]').first();
  log('bell stock rows:', norm(await pop.innerText().catch(() => 'NONE')).replace(/\n+/g,' | '));
  await t.shot('k-bell-owner');
  await pop.getByRole('button').first().click();
  await p.waitForURL(/stock\/order/, { timeout: 60000 }).catch(() => log('no nav from bell'));
  log('after click URL', p.url());
  await p.waitForTimeout(1200);
  log('bell badge after read:', await p.locator('[data-f="F-01-007"] span[aria-hidden]').allInnerTexts());
  await t.go('master', '/biz/stock');
  await p.getByRole('button', { name: 'Уведомления' }).first().click(); await p.waitForTimeout(1200);
  log('master bell stock rows:', await p.locator('[data-f="F-00-137"]').count());
  await p.keyboard.press('Escape');
};
