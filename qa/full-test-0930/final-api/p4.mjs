const BK = 'bk_01M3TCACCYT4E8G7B9E3YJ7F9H';
export default async ({ go, shot, page, api }) => {
  const r = {};
  await go('/biz/journal', 4000);
  await page.getByRole('button', { name: 'Вернул' }).first().click();
  await page.waitForTimeout(3000);
  await shot('p4-refunded', false);
  r.panel = (await page.getByText('Требует внимания').locator('xpath=../..').innerText()).slice(0, 200);
  const b = (await api('GET', `/v1/biz/biz_nuri/bookings/${BK}`)).data;
  r.prepayment = b.prepayment;
  return r;
};
