// Лилит (администратор): «Расчёт» за октябрь (владелец) + «Моя зарплата» и «Приложения → Зарплата» (persona admin)
export default async ({ page, go, shot, switchRole }) => {
  const r = {};
  const mock = process.env.MODE === 'mock';
  await go(`/biz/payroll/period${mock ? '?demo=owner' : ''}`, 5000);
  await page.locator('main').getByRole('button', { name: /октября 2026/ }).first().click(); await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Этот месяц' }).or(page.getByRole('option', { name: 'Этот месяц' })).first().click();
  await page.waitForTimeout(4000);
  const card = page.locator('main').getByText('Лилит Мкртчян').first().locator('xpath=ancestor::*[.//button[@aria-expanded]][1]');
  await card.getByRole('button', { name: /Оказано услуг/ }).click(); await page.waitForTimeout(1200);
  r.period = (await card.innerText()).replace(/\s+/g, ' ').slice(0, 700);
  await shot('lilit-period');
  if (!mock) await switchRole('admin');
  await go(`/biz/payroll/me${mock ? '?demo=admin' : ''}`, 5000);
  r.me = (await page.innerText('main')).replace(/\s+/g, ' ').slice(0, 400);
  await shot('lilit-me');
  await go(`/biz/apps/payroll${mock ? '?demo=admin' : ''}`, 5000);
  r.app = (await page.innerText('main')).replace(/\s+/g, ' ').slice(0, 400);
  await shot('lilit-app');
  return r;
};
