/**
 * Типы раздела «services». Файл принадлежит разделу — пишите сюда свои сущности.
 * Ссылайтесь на сущности ядра по id (import type { Id } from '@/domain/core').
 */
import type { Id, ISODateTime, LocalizedText } from '@/domain/core';

/** Отметка, что перевод сделан автоматически (F-03-115, F-15-141) — пока правку не подтвердили */
export interface AutoTranslateMark {
  hy?: boolean;
  en?: boolean;
}

/** Своя цена/длительность мастера по услуге (F-02-058, F-16-030) */
export interface StaffServiceTerm {
  serviceId: Id;
  staffId: Id;
  price?: number;
  durationMin?: number;
}

/** Технический перерыв услуги: нет поля — «общий», 0 — «без перерыва», N — своя длительность (F-02-060) */
export type TechBreakMode = 'shared' | 'none' | 'custom';

/** Данные позиции для чека (F-07-149) */
export interface ServiceReceiptInfo {
  receiptName?: LocalizedText;
  taxSystem?: 'general' | 'simplified' | 'patent' | 'none';
  taxRatePct?: number;
}

/**
 * Выбор варианта/оттенка при записи (F-00-094). Включение — Service.shadeChoice (ядро, required/preferred);
 * здесь только КАК выбирать: палитра склада (сфера с has('palette')) или свой список вариантов.
 */
export type PickOptionsMode = 'palette' | 'manual';
export interface ServicePickOptions {
  mode: PickOptionsMode;
  manualOptions?: LocalizedText[];
}

/**
 * «Услуга доступна ограниченное время» (F-02-067, вкладка «Онлайн-запись» услуги F-03-129): сезонная или акционная
 * услуга видна клиенту онлайн только в эти даты, дни недели и часы. Нет поля или enabled=false — всегда.
 */
export interface ServiceOnlineWindow {
  enabled: boolean;
  /** 'YYYY-MM-DD', включительно */
  dateFrom?: string;
  dateTo?: string;
  /** 0 — понедельник … 6 — воскресенье (как WeekdayPicker); пусто — все дни */
  weekdays?: number[];
  /** 'HH:mm' */
  timeFrom?: string;
  timeTo?: string;
}

/** Дополнительные (наши) поля услуги сверх ядра. Ключ — Service.id */
export interface ServiceExtra {
  autoTranslated?: AutoTranslateMark;
  receipt?: ServiceReceiptInfo;
  pickOptions?: ServicePickOptions;
  onlineWindow?: ServiceOnlineWindow;
  /** ⭐ Допродажа при записи (01.10.2026): сопутствующие услуги и товары; нет поля — ничего не предлагаем */
  upsell?: ServiceUpsell;
}

// ─────────────────────────── ⭐ Допродажа при записи (владелец, 01.10.2026) ───────────────────────────

/** Не больше стольких сопутствующих каждого вида у одной услуги — клиенту короткий блок, а не каталог */
export const UPSELL_MAX = 12;

/**
 * «Сопутствующие услуги и товары» карточки услуги: что предложить клиенту, когда он записывается на неё онлайн
 * (виджет, ссылка, приложение, каталог), и подсказать администратору в окне записи. Услуги продлевают запись у того
 * же мастера, товары — строки «товары визита» к оплате на месте (обычная продажа склада).
 */
export interface ServiceUpsell {
  serviceIds: Id[];
  /** Товары склада (Good.id); у товара свой филиал — клиенту предлагаются товары филиала записи */
  productIds: Id[];
}

/** Сопутствующая услуга, которая помещается в выбранное время у этого мастера */
export interface UpsellServiceOffer {
  serviceId: Id;
  /** К какой услуге записи предложена (её список) */
  parentServiceId: Id;
  name: LocalizedText;
  durationMin: number;
  durationMax?: number;
  priceMin: number;
  priceMax?: number;
}

/** Сопутствующий товар, который есть на складе продаж филиала */
export interface UpsellProductOffer {
  productId: Id;
  parentServiceId: Id;
  name: LocalizedText;
  price: number;
  /** Сколько ещё можно взять (остаток минус отложенное к будущим записям) */
  left: number;
}

export interface UpsellOffers {
  services: UpsellServiceOffer[];
  products: UpsellProductOffer[];
}

export interface UpsellOffersQuery {
  staffId: Id;
  /** Услуги записи у этого мастера */
  serviceIds: Id[];
  /** Начало записи у этого мастера, 'YYYY-MM-DDTHH:mm' */
  start: ISODateTime;
  /** Уже добавленные сопутствующие услуги — время считается вместе с ними */
  added?: Id[];
  locationId?: Id;
}

/** Что клиент добавил к записи; цену, время и остаток проверяет сервер (мок — api) */
export interface BookingAddOns {
  serviceIds: Id[];
  productIds: Id[];
}

/** «Допродано» в карточке услуги: сколько сопутствующих взяли к ней за N дней */
export interface UpsellStats {
  days: number;
  accepted: number;
  services: number;
  products: number;
  revenue: number;
}

/** Кандидаты для выбора в карточке услуги */
export interface UpsellCandidates {
  services: { id: Id; name: LocalizedText; categoryId: Id; durationMin: number; priceMin: number; priceMax?: number }[];
  products: { id: Id; name: string; price: number; locationId: Id; locationName?: LocalizedText }[];
}

/** Мастер услуги в форме: своя цена/длительность, пусто — базовая услуги (F-02-058, F-16-030) */
export interface ServiceStaffEntry {
  staffId: Id;
  price?: number;
  durationMin?: number;
}

/** Выбранный шаблон с правками до добавления (У25): цена, длительность, категория, мастера */
export interface TemplatePick {
  templateId: string;
  priceMin: number;
  durationMin: number;
  /** Существующая категория; нет — категория шаблона (найдётся по имени или заведётся) */
  categoryId?: Id;
  staffIds: Id[];
}

/** Строка загрузки прайса из Excel/CSV (F-02-063 расширено): категории заводятся сами */
export interface CatalogImportRow {
  category: string;
  name: string;
  priceMin: number;
  priceMax?: number;
  durationMin: number;
}

/** Дополнительные поля категории сверх ядра. Ключ — ServiceCategory.id */
export interface CategoryExtra {
  onlineNameEnabled?: boolean;
  onlineName?: LocalizedText;
  autoTranslated?: AutoTranslateMark;
}

/** Готовая услуга шаблона сферы (F-00-083, F-00-173) — тексты сразу на трёх языках */
export interface ServiceTemplateItem {
  id: string;
  categoryName: LocalizedText;
  name: LocalizedText;
  durationMin: number;
  priceMin: number;
  kind?: 'individual' | 'group';
}

export type ServiceListSort = 'order' | 'name' | 'price' | 'duration';

export interface ServiceListFilters {
  categoryId?: Id;
  kind?: 'individual' | 'group';
  onlineOnly?: boolean;
}

// ─────────────────────────── Фото работ (F-00-085, F-00-086) ───────────────────────────

/** Мест на мастера в подписке — сверх этого нужно покупать (F-00-085) */
export const PHOTO_BASE_SLOTS = 6;
/** Цена одного дополнительного места, монеты (F-00-086; В-15: 50 монет, навсегда — таблица цен сервера) */
export const PHOTO_EXTRA_SLOT_PRICE_COINS = 50;

/** На какую услугу привязано фото работы — ключ: сама data URL фото (Staff.photos[i]) */
export type PhotoServiceLinks = Record<string, Id | undefined>;

// ─────────────────────────── Дипломы и сертификаты (F-00-088) ───────────────────────────

export interface StaffDocument {
  id: Id;
  staffId: Id;
  businessId: Id;
  /** data URL картинки документа */
  imageUrl: string;
  fileName?: string;
  uploadedAt: ISODateTime;
  /** id записи в общей очереди проверки платформы (src/api/platform/moderation.ts) */
  moderationId?: Id;
}

// ─────────────────────────── Материалы и стерилизация (F-00-089, F-00-090) ───────────────────────────

/** Готовые метки материалов по умолчанию (❓ не решено — список без привязки к сфере, наше решение) */
export const MATERIAL_TAG_IDS = ['hypoallergenic', 'vegan', 'unscented', 'premiumBrand', 'organic'] as const;
export type MaterialTagId = (typeof MATERIAL_TAG_IDS)[number];

export type SterilizationMethod = 'autoclave' | 'craftBags' | 'disposable';

export interface SterilizationInfo {
  methods: SterilizationMethod[];
  note?: string;
}

// ─────────────────────────── Жалоба на контент (F-00-091) ───────────────────────────

export type ReportContentKind = 'photo' | 'story' | 'staff' | 'document';

export interface ReportContentInput {
  kind: ReportContentKind;
  businessId: Id;
  refId: Id;
  staffId?: Id;
  reason: string;
}

// ─────────────────────────── Похожие названия (шаблоны, импорт — У25) ───────────────────────────

function nameTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1)
    .sort();
}

/** «Классический маникюр» ≈ «Маникюр классический»: тот же набор слов в любом порядке */
export function isSameServiceName(a: LocalizedText, b: LocalizedText): boolean {
  const variants = (t: LocalizedText) => [t.ru, t.hy, t.en].filter((x): x is string => Boolean(x?.trim())).map((x) => nameTokens(x).join(' '));
  const left = variants(a);
  const right = new Set(variants(b));
  return left.some((x) => x && right.has(x));
}

/** Какая из существующих категорий подходит к категории шаблона: то же имя или все слова шаблона входят в имя */
export function matchCategory<T extends { id: Id; name: LocalizedText }>(target: LocalizedText, categories: T[]): T | undefined {
  const words = nameTokens(target.ru);
  if (!words.length) return undefined;
  const exact = categories.find((c) => nameTokens(c.name.ru).join(' ') === words.join(' '));
  if (exact) return exact;
  return categories.find((c) => {
    const have = new Set(nameTokens(c.name.ru));
    return words.every((w) => have.has(w));
  });
}

/** Проверка «от–до» (У14): «до» должно быть больше «от» */
export function isRangeValid(min: number | undefined, max: number | undefined): boolean {
  return min == null || max == null || max > min;
}
