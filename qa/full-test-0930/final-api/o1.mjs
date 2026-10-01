export default async ({ go, api }) => {
  await go('/biz/journal', 800);
  const c = await api('POST', '/v1/biz/biz_nuri/bookings', { staffId: 'st_nuri_ani', clientId: 'cl_01M3TB3D2V9D2QV73PAVJRYTF4', locationId: 'loc_nuri', start: '2026-10-05T20:15', durationMin: 45, status: 'awaiting_confirmation', services: [{ serviceId: 'sv_nuri_classic', qty: 1, price: 5000, staffId: 'st_nuri_ani', durationMin: 45 }], source: 'link' });
  const id = c.data.id;
  const o = await api('POST', `/v1/biz/biz_nuri/online/requests/${id}/offer-times`, { starts: ['2026-10-05T19:15', '2026-10-05T21:15'] });
  return { err: JSON.stringify(c.data).slice(0,200), id, c: c.status, o: o.status + ' ' + JSON.stringify(o.data).slice(0, 200) };
};
