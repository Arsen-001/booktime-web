/**
 * Языки (F-00-172). ru — основной, любой другой язык при отсутствии ключа берёт ru.
 * SUPPORTED_LOCALES — языки, которые код умеет (форматы дат/денег, шрифт). LOCALES — включённые сейчас.
 * 25.09.2026 пользователь: «пока только английский и русский». Как добавить язык — docs/ADDING-A-LANGUAGE.md.
 */
export const SUPPORTED_LOCALES = ['ru', 'en', 'hy'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const LOCALES: readonly Locale[] = ['ru', 'en'];
export const DEFAULT_LOCALE: Locale = 'ru';

/**
 * О3 (онлайн-запись, 27.09.2026): клиентская часть (страница салона, запись, запись по ссылке) уже говорит
 * по-армянски раньше кабинета — у DIKIDI и Fresha армянского нет. Порядок — как в переключателе «Հայ / Рус / Eng».
 * Кабинет по-прежнему предлагает только LOCALES; армянский там показывает ru там, где перевода ещё нет.
 */
export const CLIENT_LOCALES: readonly Locale[] = ['hy', 'ru', 'en'];

/** Часовой пояс продукта — все даты считаются по Еревану. */
export const TIME_ZONE = 'Asia/Yerevan';

/**
 * Пространства имён словарей = файлы messages/<lang>/<ns>.json.
 * common и ui — фундамент; остальные — по одному на раздел (id из docs/areas.json).
 */
export const NAMESPACES = [
  'common',
  'ui',
  'client',
  'platform',
  'journal',
  'schedule',
  'online',
  'clients',
  'notify',
  'loyalty',
  'finance',
  'stock',
  'payroll',
  'staff',
  'network',
  'reports',
  'integrations',
  'settings',
  'resources',
  'services',
  'orders',
] as const;
export type Namespace = (typeof NAMESPACES)[number];

/** Язык, который код умеет показать (cookie `lang`, язык ссылки). hy принимается ради клиентской части (О3). */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Строка, которую видит пользователь вместо ключа, которого нет даже в ru. */
export const MISSING_TEXT = '⋯';
