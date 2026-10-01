export default async ({ go, shot, page, text, api }) => {
  const r = {};
  await go('/biz/reports', 5000);
  await shot('r1-reports');
  r.t = (await text()).slice(0, 1500);
  const ov = await api('GET', '/v1/biz/biz_nuri/reports/overview?from=2026-10-01&to=2026-10-01');
  r.ov = JSON.stringify(ov.data).slice(0, 600);
  return r;
};
