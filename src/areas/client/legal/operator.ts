import type { Locale } from '@/i18n/config';

/**
 * Реквизиты оператора персональных данных для /privacy, /terms, /account-deletion, /support.
 * Компания (свидетельство о регистрации, 05.10.2026): ООО «АИ Свитч» / ԱԻ ՍՎԻՏՉ ՍՊԸ / AI Switch LLC,
 * регистрационный номер 999.110.1592631, ИНН (ՀՎՀՀ) 01098805, зарегистрировано 29.06.2026.
 * 🔴 ЗАПОЛНИТ ВЛАДЕЛЕЦ: почта для обращений — пока заглушка в квадратных скобках.
 */
export const OPERATOR: {
  company: Record<Locale, string>;
  address: Record<Locale, string>;
  email: string;
} = {
  company: {
    ru: 'ООО «АИ Свитч» (ИНН 01098805)',
    hy: '«ԱԻ ՍՎԻՏՉ» ՍՊԸ (ՀՎՀՀ 01098805)',
    en: 'AI Switch LLC (tax ID 01098805)',
  },
  address: {
    ru: 'Армения, 0056, Ереван, ул. Кочаряна, 10, кв. 4',
    hy: 'Հայաստան, 0056, Երևան, Քոչարյան փ., 10, բն. 4',
    en: '10 Kocharyan St, Apt 4, Yerevan 0056, Armenia',
  },
  email: '[Email для обращений]',
};

/** Подставить реквизиты в текст: {company}, {address}, {email} */
export function fillOperator(text: string, locale: Locale): string {
  return text.replaceAll('{company}', OPERATOR.company[locale]).replaceAll('{address}', OPERATOR.address[locale]).replaceAll('{email}', OPERATOR.email);
}
