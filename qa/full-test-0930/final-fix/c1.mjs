// Мастер: «Моя зарплата» (обе вкладки) и «Сторис» — нет ли запросов без права; часы
export default async ({ page, go, shot, text }) => {
  const reqs = [];
  page.on('response', (r) => { if (/:401[01]/.test(r.url()) && r.status() >= 400) reqs.push(`${r.status()} ${r.url().replace(/http:\/\/localhost:401[01]/, '')}`); });
  await go('/biz/payroll/me', 4000);
  await shot('me');
  const me = (await text()).slice(0, 400);
  await page.getByRole('tab', { name: 'Выплаты' }).click().catch(() => {});
  await page.waitForTimeout(3000);
  await shot('me-payouts');
  const payouts = (await text()).slice(0, 300);
  const meReq = [...reqs]; reqs.length = 0;
  await go('/biz/apps/payroll', 4000);
  await shot('app-payroll');
  const app = (await text()).slice(0, 400);
  const appReq = [...reqs]; reqs.length = 0;
  await go('/biz/apps/stories', 4000);
  await shot('stories');
  return { me, payouts, meReq, app, appReq, storiesReq: [...reqs] };
};
