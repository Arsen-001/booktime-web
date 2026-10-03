/** Типы раздела «platform»: visits. */
import type { DistrictId, ISODate, ISODateTime, Id, Money, SphereId } from '@/domain/core';

// ─────────────────────────── Визиты (F-00-177) ───────────────────────────

export type VisitStatus = 'connected' | 'thinking' | 'refused';

export interface VisitEvent {
  id: Id;
  at: ISODateTime;
  kind: 'created' | 'status' | 'callback' | 'callbackDone' | 'note' | 'connected';
  status?: VisitStatus;
  date?: ISODate;
  text?: string;
}

/** Чем салон ведёт запись сейчас — спрашиваем на визите (F-00-207, к решению о цене) */
export type VisitTool = 'dikidi' | 'altegio' | 'emly' | 'fresha' | 'whatsapp' | 'notebook' | 'other' | 'nothing';

export interface Visit {
  id: Id;
  placeName: string;
  contactName?: string;
  phone?: string;
  district: DistrictId;
  address?: string;
  sphereId?: SphereId;
  status: VisitStatus;
  visitedAt: ISODate;
  /** Дата «перезвонить» — в этот день напоминание */
  callbackDate?: ISODate;
  refusalReason?: string;
  note?: string;
  currentTool?: VisitTool;
  /** Сколько готовы платить в месяц, драм */
  willingToPay?: Money;
  responsibleId: Id;
  businessId?: Id;
  promoCodeId?: Id;
  /** Место из базы «Места», к которому ходили (статус места — из последнего визита) */
  prospectId?: Id;
  history: VisitEvent[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type VisitInput = Pick<
  Visit,
  | 'placeName'
  | 'contactName'
  | 'phone'
  | 'district'
  | 'address'
  | 'sphereId'
  | 'status'
  | 'visitedAt'
  | 'callbackDate'
  | 'refusalReason'
  | 'note'
  | 'currentTool'
  | 'willingToPay'
  | 'responsibleId'
  | 'prospectId'
>;
