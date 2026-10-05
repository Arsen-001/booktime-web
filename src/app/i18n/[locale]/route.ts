import { SUPPORTED_LOCALES, isLocale } from '@/i18n/config';
import { loadMessages } from '@/i18n/load';

/**
 * Все словари языка одним JSON (с запасным ru и списком подставленных ключей) — для перехода с публичной страницы,
 * которая получила только свои словари, в кабинет или профиль (src/i18n/IntlProvider.tsx, src/i18n/routeMessages.ts).
 * Собирается при сборке: словари меняются только с выкладкой.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function GET(_request: Request, { params }: RouteContext<'/i18n/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response(null, { status: 404 });
  return Response.json(await loadMessages(locale));
}
