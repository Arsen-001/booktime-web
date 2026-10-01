export default async ({ go, shot, page, text }) => {
  await go('/biz/payroll/me', 4000);
  await page.getByRole('tab', { name: 'Выплаты' }).click();
  await page.waitForTimeout(3000);
  await shot('z2-payouts');
  return { t: (await text()).slice(0, 500) };
};
