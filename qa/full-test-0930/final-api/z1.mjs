export default async ({ go, shot, page, text, api }) => {
  const r = {};
  await go('/biz/journal', 3000);
  const hrefs = await page.$$eval('a[href^="/biz"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
  r.menuPayrollMe = hrefs.includes('/biz/payroll/me'); r.menuPayroll = hrefs.includes('/biz/payroll');
  r.menu = hrefs.join(' ');
  await go('/biz/payroll/me', 4000);
  await shot('z1-payroll-me');
  r.me = (await text()).slice(0, 500);
  await go('/biz/payroll/period', 4000);
  await shot('z1-payroll-period');
  r.period = (await text()).slice(0, 500);
  const p = await api('GET', '/v1/biz/biz_nuri/payroll/period?from=2026-10-01&to=2026-10-31');
  r.api = p.status + ' ' + JSON.stringify((p.data?.rows ?? p.data)?.map?.((x) => x.staffId) ?? p.data).slice(0, 200);
  return r;
};
