// Три экрана «отработано»: Расчёт (владелец), Моя зарплата и Приложения → Зарплата (мастер Ани)
export default async ({ page, go, shot, switchRole, device }) => {
  const r = {};
  const mock = process.env.MODE === 'mock';
  const grab = async () => (await page.innerText('main')).split('\n').filter((l) => /дн|ч\b|час|графику|Рабоч|Отработано|^\d/.test(l)).slice(0, 14);
  await go(`/biz/payroll/period${mock ? '?demo=owner' : ''}`, 5000);
  if (device === 'phone') { await switchRole('master'); await go('/biz/payroll/me', 5000); await shot('hrs-me'); await go('/biz/apps/payroll', 5000); await shot('hrs-app'); return { ok: 1 }; }
  await page.locator('main').getByRole('button', { name: /октября 2026/ }).first().click(); await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Этот месяц' }).or(page.getByRole('option', { name: 'Этот месяц' })).first().click().catch((e) => { r.pickErr = String(e).slice(0, 80); });
  await page.waitForTimeout(4000);
  await shot('hrs-period');
  r.period = (await page.innerText('main')).split('\n').filter((l) => /Ани|Лилит|графику|до конца|^\d[\d ]* ֏/.test(l)).slice(0, 12);
  if (!mock) await switchRole('master');
  await go(`/biz/payroll/me${mock ? '?demo=master' : ''}`, 5000);
  await shot('hrs-me');
  r.me = await grab();
  await go(`/biz/apps/payroll${mock ? '?demo=master' : ''}`, 5000);
  await shot('hrs-app');
  r.app = await grab();
  return r;
};
