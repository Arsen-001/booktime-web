import { MOBILE_APPS } from '@/lib/native/apps';

/**
 * Universal links iOS (приложения booktime-mobile): какие ссылки booktime.am открываются в приложении.
 * Нужен Team ID аккаунта Apple Developer (env APPLE_TEAM_ID); без него — 404, выдуманных значений не отдаём.
 * Apple забирает файл через свой CDN по https без перенаправлений, тип — application/json.
 */
export function GET() {
  const team = process.env.APPLE_TEAM_ID?.trim();
  if (!team || !/^[A-Z0-9]{10}$/.test(team)) return new Response('Not found', { status: 404 });
  const components = (paths: readonly string[]) =>
    paths.flatMap((p) => (p.endsWith('/') ? [{ '/': `${p}*` }] : [{ '/': p }, { '/': `${p}/*` }]));
  const body = {
    applinks: {
      details: Object.values(MOBILE_APPS).map((app) => ({
        appIDs: [`${team}.${app.id}`],
        components: components(app.paths),
      })),
    },
  };
  return Response.json(body, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
