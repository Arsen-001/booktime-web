import 'server-only';
import { getLocale, getTranslations } from 'next-intl/server';
import type { MasterCard } from '@/api/client';
import type { PublicBusinessData } from '@/api/online';
import type { DistrictId, LocaleCode, Service, SphereId, WeekTemplate } from '@/domain/core';
import { isLocale } from '@/i18n/config';
import { formatMoney } from '@/lib/money';
import { absoluteUrl } from '@/lib/seo/site';
import { pickText } from '@/lib/text';

/**
 * Тексты и разметка schema.org для поисковиков (SEO, 03.10.2026). Слова — common.seo / common.districts на языке
 * запроса (cookie `lang`; поисковик без cookie видит ru — язык в адресе не живёт, см. DESIGN.md «Поисковики»).
 */

type T = Awaited<ReturnType<typeof getTranslations<'common'>>>;

export interface SeoContext {
  t: T;
  locale: LocaleCode;
}

export async function seoContext(): Promise<SeoContext> {
  const [t, raw] = await Promise.all([getTranslations('common'), getLocale()]);
  return { t, locale: isLocale(raw) ? raw : 'ru' };
}

/** Описание для сниппета: Google показывает ~155–160 символов — режем по слову */
export function clampDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,.;:—–-]+$/, '')}…`;
}

function lowerFirst(s: string, locale: LocaleCode): string {
  return s ? s[0].toLocaleLowerCase(locale) + s.slice(1) : s;
}

/** «Стрижки и окрашивание, косметология» — по сферам бизнеса (не больше двух) */
export function servicesPhrase({ t, locale }: SeoContext, sphereIds: SphereId[]): string {
  const list = sphereIds.slice(0, 2).map((s) => t(`seo.services.${s}`));
  return list.map((s, i) => (i === 0 ? s : lowerFirst(s, locale))).join(', ');
}

export function districtLabel({ t }: SeoContext, district: DistrictId | undefined): string | undefined {
  return district ? t(`districts.${district}`) : undefined;
}

function minPrice(services: Pick<Service, 'priceMin'>[]): number | undefined {
  const prices = services.map((s) => s.priceMin).filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : undefined;
}

function maxPrice(services: Pick<Service, 'priceMin' | 'priceMax'>[]): number | undefined {
  const prices = services.map((s) => s.priceMax ?? s.priceMin).filter((p) => p > 0);
  return prices.length ? Math.max(...prices) : undefined;
}

/** Картинки, которые поисковик может скачать: только http(s) — data: из демо-данных отбрасываем */
function fetchableImages(urls: (string | undefined)[]): string[] {
  return urls.filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u));
}

export interface BusinessSeo {
  /** «Vard Beauty Lounge — стрижки и окрашивание, косметология, Арабкир, Ереван» (без « | BookTime») */
  title: string;
  description: string;
  name: string;
  services: string;
  district?: string;
  images: string[];
}

export function describeBusiness(ctx: SeoContext, data: PublicBusinessData): BusinessSeo {
  const { t, locale } = ctx;
  const { business, location, services } = data;
  const name = business.name.trim() || business.slug;
  const phrase = servicesPhrase(ctx, business.sphereIds);
  const district = districtLabel(ctx, location?.district);
  const title = district
    ? t('seo.business.title', { name, services: lowerFirst(phrase, locale), district })
    : t('seo.business.titleNoDistrict', { name, services: lowerFirst(phrase, locale) });

  const from = minPrice(services);
  const serviceNames = services
    .filter((s) => s.active !== false)
    .slice(0, 5)
    .map((s) => pickText(s.name, locale))
    .filter(Boolean);
  const own = pickText(business.description, locale);
  const parts = [
    own || t('seo.business.fallback', { name, services: lowerFirst(phrase, locale) }),
    !own && serviceNames.length ? t('seo.business.servicesList', { list: serviceNames.join(', ') }) : '',
    from ? t('seo.business.priceFrom', { price: formatMoney(from) }) : '',
    t('seo.business.book'),
  ];
  return {
    title,
    description: clampDescription(parts.filter(Boolean).join(' ')),
    name,
    services: phrase,
    district,
    images: fetchableImages([...business.photos, business.logoUrl]),
  };
}

export interface MasterSeo {
  title: string;
  description: string;
  canonicalPath: string;
}

export function describeMaster(ctx: SeoContext, card: MasterCard): MasterSeo {
  const { t, locale } = ctx;
  const { staff, business, locations } = card;
  const position = pickText(staff.position, locale) || servicesPhrase(ctx, staff.sphereIds);
  const district = districtLabel(ctx, locations[0]?.district);
  const city = t('seo.city');
  const businessName = business.name.trim() || business.slug;
  // Мастер-одиночка (ИП): его бизнес и есть он — без повтора имени
  const solo = business.kind === 'individual';
  const title = solo
    ? t('seo.business.titleNoDistrict', { name: staff.name, services: lowerFirst(position, locale) })
    : t('seo.master.title', { name: staff.name, position: lowerFirst(position, locale), business: businessName });
  const description = t('seo.master.description', {
    name: staff.name,
    position: lowerFirst(position, locale),
    business: businessName,
    place: district ? `${district}, ${city}` : city,
  });
  return { title, description: clampDescription(description), canonicalPath: solo ? `/b/${business.slug}` : `/masters/${staff.id}` };
}

// ─────────────────────────── schema.org (JSON-LD) ───────────────────────────

/** Подтип LocalBusiness по сфере (https://schema.org/LocalBusiness) */
const SPHERE_TYPE: Record<SphereId, string> = {
  nails: 'NailSalon',
  barber: 'HairSalon',
  hair: 'HairSalon',
  cosmetology: 'BeautySalon',
  massage: 'DaySpa',
  dental: 'Dentist',
  fitness: 'ExerciseGym',
  carwash: 'AutoWash',
  general: 'LocalBusiness',
};
const BEAUTY_TYPES = new Set(['NailSalon', 'HairSalon', 'BeautySalon', 'DaySpa']);

function businessType(sphereIds: SphereId[]): string {
  const types = [...new Set(sphereIds.map((s) => SPHERE_TYPE[s] ?? 'LocalBusiness'))];
  if (types.length === 0) return 'LocalBusiness';
  if (types.length === 1) return types[0];
  // Салон «стрижки + косметология» — салон красоты; смешанное с не-красотой — общий тип
  return types.every((x) => BEAUTY_TYPES.has(x)) ? 'BeautySalon' : 'LocalBusiness';
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/** Часы филиала (0 = понедельник) → openingHoursSpecification, одинаковые интервалы склеиваем по дням */
function openingHours(week: WeekTemplate | undefined) {
  if (!week) return undefined;
  const byRange = new Map<string, { opens: string; closes: string; days: string[] }>();
  DAYS.forEach((day, i) => {
    for (const r of week[i as keyof WeekTemplate] ?? []) {
      const key = `${r.from}-${r.to}`;
      const entry = byRange.get(key) ?? { opens: r.from, closes: r.to, days: [] };
      entry.days.push(day);
      byRange.set(key, entry);
    }
  });
  const spec = [...byRange.values()].map((e) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: e.days.length === 1 ? e.days[0] : e.days,
    opens: e.opens,
    closes: e.closes,
  }));
  return spec.length ? spec : undefined;
}

function sameAs(socials: PublicBusinessData['business']['socials']): string[] | undefined {
  if (!socials) return undefined;
  const links = [
    socials.website,
    socials.instagram ? `https://www.instagram.com/${socials.instagram.replace(/^@/, '')}` : undefined,
    socials.facebook ? (/^https?:\/\//.test(socials.facebook) ? socials.facebook : `https://www.facebook.com/${socials.facebook}`) : undefined,
    socials.telegramUrl,
  ];
  const out = fetchableImages(links);
  return out.length ? out : undefined;
}

/**
 * Бизнес для поисковиков: подтип по сфере, адрес (точный — только если мастер не скрыл его до записи, F-00-077),
 * часы, цены, услуги, запись. aggregateRating НЕ выдаём: публичных оценок у сервера нет (отзывы о месте — без
 * оценки, оценки мастеров бизнес может скрыть) — выдумывать нельзя, см. DESIGN.md «Поисковики».
 */
export function businessJsonLd(ctx: SeoContext, data: PublicBusinessData, seo: BusinessSeo) {
  const { t, locale } = ctx;
  const { business, location, services, addressHidden } = data;
  const url = absoluteUrl(`/b/${business.slug}`);
  const lo = minPrice(services);
  const hi = maxPrice(services);
  const showAddress = !addressHidden;
  const street = showAddress ? pickText(location?.address, locale) : '';
  const telephone = location?.phone ?? business.phone;
  const logo = fetchableImages([business.logoUrl])[0];
  const description = pickText(business.description, locale);
  return {
    '@context': 'https://schema.org',
    '@type': businessType(business.sphereIds),
    '@id': `${url}#business`,
    name: seo.name,
    url,
    ...(description && { description }),
    image: seo.images.length ? seo.images : [absoluteUrl(`/b/${business.slug}/opengraph-image`)],
    ...(logo && { logo }),
    ...(telephone && { telephone }),
    address: {
      '@type': 'PostalAddress',
      ...(street && { streetAddress: street }),
      addressLocality: t('seo.city'),
      ...(seo.district && { addressRegion: seo.district }),
      addressCountry: 'AM',
    },
    ...(showAddress && location?.coords && {
      geo: { '@type': 'GeoCoordinates', latitude: location.coords.lat, longitude: location.coords.lng },
    }),
    ...(lo && { priceRange: hi && hi > lo ? `${lo}–${hi} AMD` : `${lo} AMD` }),
    currenciesAccepted: 'AMD',
    ...(openingHours(location?.openHours) && { openingHoursSpecification: openingHours(location?.openHours) }),
    ...(sameAs(business.socials) && { sameAs: sameAs(business.socials) }),
    ...(services.length > 0 && {
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: seo.services,
        itemListElement: services.slice(0, 30).map((s) => ({
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: pickText(s.name, locale) },
          ...(s.priceMin > 0 && {
            priceSpecification: {
              '@type': 'PriceSpecification',
              priceCurrency: 'AMD',
              minPrice: s.priceMin,
              ...(s.priceMax && s.priceMax > s.priceMin && { maxPrice: s.priceMax }),
            },
          }),
        })),
      },
    }),
    potentialAction: {
      '@type': 'ReserveAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${url}/book` },
    },
  };
}

/** Главная: кто мы и поиск по сайту */
export function homeJsonLd({ t }: SeoContext) {
  const site = absoluteUrl('/');
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${site}#organization`,
      name: t('app.name'),
      url: site,
      logo: absoluteUrl('/icons/icon-512.png'),
      description: t('seo.org.description'),
      areaServed: { '@type': 'City', name: t('seo.city') },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${site}#website`,
      name: t('app.name'),
      url: site,
      inLanguage: ['hy', 'ru', 'en'],
      publisher: { '@id': `${site}#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${absoluteUrl('/search')}?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
  ];
}
