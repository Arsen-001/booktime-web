export default async ({ go, shot, page, api }) => {
  const r = {};
  await go('/biz/journal', 1500);
  const c = await api('POST', '/v1/biz/biz_nuri/bookings', { staffId: 'st_nuri_ani', clientId: 'cl_01M3TB3D2V9D2QV73PAVJRYTF4', locationId: 'loc_nuri', start: '2026-10-01T20:00', durationMin: 45, status: 'arrived', services: [{ serviceId: 'sv_nuri_classic', qty: 1, price: 5000, staffId: 'st_nuri_ani', durationMin: 45 }], source: 'journal' });
  r.create = c.status + ' ' + JSON.stringify(c.data).slice(0, 200);
  const BK = c.data.id;
  r.BK = BK;
  await go(`/biz/journal?date=2026-10-01&booking=${BK}`, 4000);
  const reqs = [];
  page.on('request', (q) => { if (q.url().includes(':4010') && q.method() !== 'GET') reqs.push(q.method() + ' ' + q.url().slice(21, 140) + ' ' + (q.postData() || '').slice(0, 150)); });
  await page.locator('[role=dialog]').last().getByRole('button', { name: /^Оплатить/ }).last().click();
  await page.waitForTimeout(2000);
  await page.locator('[role=dialog]').last().getByRole('button', { name: /Наличные/ }).click();
  await page.waitForTimeout(4000);
  r.reqs = reqs;
  return r;
};
