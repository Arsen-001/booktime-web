import type { Locale } from '@/i18n/config';

/**
 * Реквизиты оператора персональных данных для /privacy, /terms, /account-deletion.
 * 🔴 ЗАПОЛНИТ ВЛАДЕЛЕЦ (04.10.2026): пока стоят заглушки в квадратных скобках — до публикации приложений в магазинах
 * их нужно заменить на настоящие (название компании или ИП, юридический адрес, почта для обращений по данным).
 */
export const OPERATOR: {
  company: Record<Locale, string>;
  address: Record<Locale, string>;
  email: string;
} = {
  company: {
    ru: '[Юридическое лицо]',
    hy: '[Իրավաբանական անձ]',
    en: '[Legal entity]',
  },
  address: {
    ru: '[Адрес]',
    hy: '[Հասցե]',
    en: '[Address]',
  },
  email: '[Email для обращений]',
};

/** Подставить реквизиты в текст: {company}, {address}, {email} */
export function fillOperator(text: string, locale: Locale): string {
  return text.replaceAll('{company}', OPERATOR.company[locale]).replaceAll('{address}', OPERATOR.address[locale]).replaceAll('{email}', OPERATOR.email);
}
