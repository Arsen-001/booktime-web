/** Типы раздела «platform»: ads. */
import type { DistrictId, ISODate, ISODateTime, Id, LocalizedText, Money, SphereId } from '@/domain/core';

// ─────────────────────────── Реклама (F-00-163…166) и сторис (F-00-160) ───────────────────────────

export type AdKind = 'banner' | 'supplier';
export type AdAudience = 'client' | 'business';
/** Размер бизнеса для цели показа */
export type AdSize = 'any' | 'individual' | 'salonSmall' | 'salonLarge';
/** Состояние считается из дат и паузы */
export type AdState = 'scheduled' | 'running' | 'paused' | 'finished';

/** Место показа (справочник мест баннеров и мест рекламы поставщиков) */
export interface AdPlacement {
  id: Id;
  kind: AdKind;
  audience: AdAudience;
  name: LocalizedText;
  pricePerDay: Money;
  active: boolean;
}

export interface AdTarget {
  sphereIds: SphereId[];
  districts: DistrictId[];
  size: AdSize;
  /** Не меньше стольких звёздочек (F-00-116) */
  minStars?: number;
}

export interface AdDayStat {
  views: number;
  clicks: number;
}

export interface Ad {
  id: Id;
  kind: AdKind;
  title: string;
  text?: string;
  imageUrl?: string;
  ctaUrl?: string;
  /** Рекламодатель без аккаунта: имя и контакт (F-00-164) */
  advertiser: { name: string; contact: string };
  placementId: Id;
  target: AdTarget;
  /** Для места «склад: товар на исходе» — товары и бренды (F-00-165) */
  productKeywords: string[];
  startDate: ISODate;
  endDate: ISODate;
  price: Money;
  paused: boolean;
  stats: Record<ISODate, AdDayStat>;
  supportTicketId?: Id;
  createdAt: ISODateTime;
}

export interface AdView extends Ad {
  state: AdState;
  views: number;
  clicks: number;
  placementName?: LocalizedText;
}

export type AdInput = Omit<Ad, 'id' | 'stats' | 'createdAt' | 'paused'> & { paused?: boolean };

/** Контекст показа: кому (для бизнеса — его данные, для клиента — район) */
export interface AdContext {
  date?: ISODate;
  businessId?: Id;
  district?: DistrictId;
  sphereId?: SphereId;
}

export interface AdReach {
  businesses: number;
  optedIn: number;
}

export type StoryScope = 'district' | 'city';

/** Настройки мест сторис (F-00-160) */
export interface StoryPlacesConfig {
  /** Сколько сторис показано одновременно */
  places: 5 | 6 | 10;
  scope: StoryScope;
  /** Цена места на день, монет */
  pricePerDay: number;
  /** Сколько последних мест дороже */
  lastPlacesCount: number;
  /** Наценка на последние места, % */
  lastPlacesMarkup: number;
  /** Наценка за очередь, % */
  queueMarkup: number;
  /** На сколько дней вперёд продаём */
  daysAhead: number;
}

export type StoryBookingMode = 'place' | 'queue';
export type StoryBookingStatus = 'active' | 'cancelled' | 'rejected';

export interface StoryBooking {
  id: Id;
  businessId: Id;
  date: ISODate;
  district?: DistrictId;
  mode: StoryBookingMode;
  price: number;
  status: StoryBookingStatus;
  source: 'template' | 'photo';
  moderationItemId?: Id;
  createdAt: ISODateTime;
  /** Статистика конкретной сторис (F-00-162) — просмотры → нажатия → записи, не занятость места */
  views: number;
  clicks: number;
  bookingsFromStory: number;
}

/** Сторис на день с местом в очереди — для доски */
export interface StoryDayBooking extends StoryBooking {
  businessName: string;
  shown: boolean;
  queuePosition?: number;
}

export interface StoryPlacesInfo {
  date: ISODate;
  district?: DistrictId;
  total: number;
  taken: number;
  queued: number;
  /** Цена места сейчас (с наценкой за последние места) */
  price: number;
  queuePrice: number;
}

export interface StoryQuote {
  available: boolean;
  info: StoryPlacesInfo;
  /** Места заняты — ближайшие дни со свободными местами */
  alternatives: StoryPlacesInfo[];
}

export interface StoryBoard {
  config: StoryPlacesConfig;
  days: (StoryPlacesInfo & { bookings: StoryDayBooking[] })[];
}
