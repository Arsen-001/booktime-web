export default async ({ go, api }) => {
  await go('/biz/journal', 1000);
  const c = await api('POST', '/v1/biz/biz_nuri/bookings', { staffId: 'st_nuri_ani', clientId: 'cl_01M3TB3D2V9D2QV73PAVJRYTF4', locationId: 'loc_nuri', start: '2026-10-03T19:00', durationMin: 45, status: 'awaiting_prepayment', prepayment: { amount: 2000, paid: false }, services: [{ serviceId: 'sv_nuri_classic', qty: 1, price: 5000, staffId: 'st_nuri_ani', durationMin: 45 }], source: 'link' });
  return { s: c.status, d: JSON.stringify(c.data).slice(0, 400) };
};
