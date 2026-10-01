/** Типы раздела «platform»: connect. */
import type { BusinessKind, CalendarMode, DistrictId, GeoPoint, ISODateTime, Id, LocalizedText, Minutes, Money, SphereId, WeekTemplate } from '@/domain/core';

// ─────────────────────────── Подключение салона на визите (F-00-176, F-00-171) ───────────────────────────

export interface ConnectInvite {
  id: Id;
  name: string;
  phone: string;
}

export interface ConnectServiceLine {
  templateId: string;
  name: LocalizedText;
  durationMin: Minutes;
  price: Money;
  selected: boolean;
}

export type ConnectStatus = 'draft' | 'done';

export interface ConnectDraft {
  id: Id;
  status: ConnectStatus;
  /** Индекс текущего шага (с 0) */
  step: number;
  kind: BusinessKind;
  name: string;
  sphereId?: SphereId;
  ownerName: string;
  ownerPhone: string;
  district?: DistrictId;
  address: string;
  yandexMapsUrl: string;
  /** Точка из кнопки «Я на месте» — без карт */
  coords?: GeoPoint;
  coordsAt?: ISODateTime;
  photos: string[];
  invites: ConnectInvite[];
  services: ConnectServiceLine[];
  hours: WeekTemplate;
  /** F-00-052: салону всегда 'free'; индивидуал выбирает сам, пропустить нельзя — undefined блокирует «Готово». */
  calendarMode?: CalendarMode;
  promoCodeId?: Id;
  visitId?: Id;
  responsibleId: Id;
  businessId?: Id;
  startedAt: ISODateTime;
  finishedAt?: ISODateTime;
}

/** Готовая услуга сферы (F-00-083) — для шага «Услуги» */
export interface SphereTemplateService {
  templateId: string;
  name: LocalizedText;
  durationMin: Minutes;
  price: Money;
}
