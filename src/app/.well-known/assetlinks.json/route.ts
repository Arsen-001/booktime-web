import { envList, MOBILE_APPS } from '@/lib/native/apps';

/**
 * App Links Android (приложения booktime-mobile): подтверждение, что приложения — наши, по SHA-256 сертификата
 * подписи (Google Play Console → Целостность приложения → Подпись приложений). env:
 *   ANDROID_SHA256_CERT           — «BookTime» (через запятую можно несколько: ключ Play и ключ загрузки)
 *   ANDROID_BUSINESS_SHA256_CERT  — «BookTime Business», если подписан другим ключом (по умолчанию — тот же список)
 * Без отпечатков — 404, выдуманных значений не отдаём.
 */
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function fingerprints(value: string | undefined): string[] {
  return envList(value)
    .map((f) => f.toUpperCase())
    .filter((f) => FINGERPRINT.test(f));
}

export function GET() {
  const client = fingerprints(process.env.ANDROID_SHA256_CERT);
  const business = fingerprints(process.env.ANDROID_BUSINESS_SHA256_CERT);
  const entries = [
    { app: MOBILE_APPS.client, certs: client },
    { app: MOBILE_APPS.business, certs: business.length ? business : client },
  ].filter((e) => e.certs.length > 0);
  if (!entries.length) return new Response('Not found', { status: 404 });
  const body = entries.map(({ app, certs }) => ({
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: app.id, sha256_cert_fingerprints: certs },
  }));
  return Response.json(body, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
