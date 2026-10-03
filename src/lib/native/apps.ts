/**
 * Приложения BookTime в App Store и Google Play (booktime-mobile) — для диплинков:
 * /.well-known/apple-app-site-association (iOS, universal links) и /.well-known/assetlinks.json (Android, App Links).
 * Пути — те же, что в booktime-mobile/scripts/native.mjs (LINK_PATHS): клиентское приложение открывает страницы
 * салонов, короткие ссылки и свои записи, Business — кабинет. Поменяли здесь — поменяйте и там.
 */
export interface MobileApp {
  /** Bundle ID (iOS) и applicationId (Android) */
  id: string;
  /** Префиксы путей сайта, которые открываются в приложении */
  paths: string[];
}

export const MOBILE_APPS = {
  client: { id: 'am.booktime.app', paths: ['/b/', '/s/', '/bookings'] },
  business: { id: 'am.booktime.business', paths: ['/biz'] },
} as const satisfies Record<'client' | 'business', MobileApp>;

/** Список из env через запятую: «A, B» → ['A', 'B'] */
export function envList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
