'use client';

/**
 * Системные статьи и кассы — на языке человека (проход 17.11). Сервер и мок заводят их по-русски («Основная касса»,
 * «Оплата услуги»…), и на hy/en кабинет показывал русские слова в операциях, кассах, отчётах и окне оплаты. Пока
 * название не переименовали (совпадает с русским по умолчанию сервера или мока) — показываем перевод; своё имя салона —
 * как есть. Язык — cookie `lang`, как у всего сайта (смена языка перерисовывает страницу).
 */
import type { LocalizedText } from '@/domain/core';
import type { Account, FinanceItem } from '@/domain/finance';

type Names = Required<Pick<LocalizedText, 'ru' | 'hy' | 'en'>> & { alt?: string[] };

/** Ключ системной статьи → перевод; alt — прежние русские имена мока (src/mock/slices/finance.ts) */
const ITEM_NAMES: Record<string, Names> = {
  materialsPurchase: { ru: 'Закупка материалов', hy: 'Նյութերի գնում', en: 'Materials purchase' },
  goodsPurchase: { ru: 'Закупка товаров', hy: 'Ապրանքների գնում', en: 'Goods purchase' },
  staffPayroll: { ru: 'Зарплата персонала', hy: 'Աշխատակիցների աշխատավարձ', en: 'Staff payroll' },
  taxes: { ru: 'Налоги', hy: 'Հարկեր', en: 'Taxes', alt: ['Налоги и сборы'] },
  servicePayment: { ru: 'Оплата услуги', hy: 'Ծառայության վճարում', en: 'Service payment', alt: ['Оказание услуг'] },
  membershipSale: { ru: 'Продажа абонемента', hy: 'Աբոնեմենտի վաճառք', en: 'Membership sale', alt: ['Продажа абонементов'] },
  goodsSale: { ru: 'Продажа товара', hy: 'Ապրանքի վաճառք', en: 'Product sale', alt: ['Продажа товаров'] },
  otherIncome: { ru: 'Прочий доход', hy: 'Այլ եկամուտ', en: 'Other income', alt: ['Прочие доходы'] },
  otherExpense: { ru: 'Прочий расход', hy: 'Այլ ծախս', en: 'Other expense', alt: ['Прочие расходы'] },
  accountTopUp: { ru: 'Пополнение счёта', hy: 'Հաշվի համալրում', en: 'Account top-up', alt: ['Пополнение счета'] },
  acquiringFee: { ru: 'Комиссия эквайринга', hy: 'Էքվայրինգի միջնորդավճար', en: 'Acquiring fee', alt: ['Комиссия за эквайринг'] },
  certificateSale: { ru: 'Продажа сертификата', hy: 'Նվեր-քարտի վաճառք', en: 'Certificate sale', alt: ['Продажа сертификатов'] },
  penaltyCharge: { ru: 'Штраф', hy: 'Տուգանք', en: 'Penalty', alt: ['Списание штрафа'] },
  depositRetained: { ru: 'Удержанный депозит', hy: 'Պահված դեպոզիտ', en: 'Retained deposit' },
  refund: { ru: 'Возврат', hy: 'Վերադարձ', en: 'Refund' },
};

/** Кассы, которые система заводит сама: по виду (cash/card) и касса предоплат (systemKey 'prepayment') */
const ACCOUNT_NAMES: Record<'cash' | 'card' | 'prepayment', Names> = {
  cash: { ru: 'Основная касса', hy: 'Հիմնական դրամարկղ', en: 'Main cash desk' },
  card: { ru: 'Расчётный счёт', hy: 'Հաշվարկային հաշիվ', en: 'Bank account' },
  prepayment: { ru: 'Предоплата на реквизиты', hy: 'Կանխավճար վավերապայմաններով', en: 'Prepayments by transfer' },
};

function uiLang(): 'ru' | 'hy' | 'en' {
  if (typeof document === 'undefined') return 'ru';
  const v = document.cookie.split('; ').find((p) => p.startsWith('lang='))?.slice(5);
  return v === 'hy' || v === 'en' ? v : 'ru';
}

function translated(name: string, names: Names | undefined, lang: 'ru' | 'hy' | 'en'): string {
  if (!names || lang === 'ru') return name;
  return name === names.ru || names.alt?.includes(name) ? names[lang] : name;
}

/** Статьи: системная с именем по умолчанию — переводом */
export function localizeItems<T extends FinanceItem>(items: T[]): T[] {
  const lang = uiLang();
  if (lang === 'ru') return items;
  return items.map((it) => {
    if (!it.system) return it;
    // Ключ — с сервера (`systemKey`); у мока ключа нет — по русскому имени по умолчанию
    const key = (it as T & { systemKey?: string }).systemKey ?? Object.keys(ITEM_NAMES).find((k) => ITEM_NAMES[k].ru === it.name || ITEM_NAMES[k].alt?.includes(it.name));
    const name = translated(it.name, key ? ITEM_NAMES[key] : undefined, lang);
    return name === it.name ? it : { ...it, name };
  });
}

/** Кассы, заведённые системой, с именем по умолчанию — переводом */
export function localizeAccounts<T extends Account>(accounts: T[]): T[] {
  const lang = uiLang();
  if (lang === 'ru') return accounts;
  return accounts.map((a) => {
    if (!a.systemGenerated) return a;
    const names = a.systemKey === 'prepayment' ? ACCOUNT_NAMES.prepayment : a.kind === 'cash' || a.kind === 'card' ? ACCOUNT_NAMES[a.kind] : undefined;
    const name = translated(a.name, names, lang);
    return name === a.name ? a : { ...a, name };
  });
}

/** Стандартные способы оплаты (ключи cash/card), пока их не переименовали */
const METHOD_NAMES: Record<'cash' | 'card', Names> = {
  cash: { ru: 'Наличные', hy: 'Կանխիկ', en: 'Cash' },
  card: { ru: 'Банковская карта', hy: 'Բանկային քարտ', en: 'Bank card' },
};

/** Подпись способа оплаты: стандартная (cash/card с русским именем по умолчанию) — переводом */
export function localizeMethodLabel(key: string, label: string): string {
  const names = key === 'cash' || key === 'card' ? METHOD_NAMES[key] : undefined;
  return translated(label, names, uiLang());
}
