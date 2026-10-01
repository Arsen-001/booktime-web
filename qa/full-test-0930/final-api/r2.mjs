export default async ({ go, api }) => {
  await go('/biz/journal', 500);
  const ov = await api('GET', '/v1/biz/biz_nuri/reports/overview?from=2026-09-02&to=2026-10-01');
  return { occ: JSON.stringify(ov.data.occupancy ?? ov.data.fill ?? Object.keys(ov.data)).slice(0, 700) };
};
