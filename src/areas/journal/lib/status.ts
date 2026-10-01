/**
 * Цвет и значок записи по статусу и источнику (F-01-027, F-01-078).
 * Токены Altegio (rgb/rgba) не используем — красим ТОЛЬКО токенами темы (CONVENTIONS §4);
 * различимость шести состояний сохранена подбором tone + значка.
 */
import { AlertCircle, type LucideIcon } from "lucide-react";
import type { Booking, BookingSource, BookingStatus } from "@/domain/core";
import type { BadgeTone } from "@/ui/Badge";
import { BOOKING_STATUS_META } from "@/ui/BookingStatusBadge";

/**
 * «Визит оплачен не полностью» (F-01-079): визит состоялся, но оплаченная сумма меньше суммы визита —
 * в том числе 0, если оплату сняли («Отменить оплату» → удалили оплату → этот статус).
 */
export function isNotFullyPaid(
  status: BookingStatus,
  total: number,
  paidAmount: number,
): boolean {
  return status === "arrived" && paidAmount < total;
}

export interface StatusMeta {
  tone: BadgeTone;
  icon: LucideIcon;
}

// Единая карта иконок/тонов статуса — @/ui/BookingStatusBadge (ux-r5 R5-M4): та же карта,
// что в сетке, окне и «Записях», иначе один статус красится по-разному на соседних экранах.
const BASE_STATUS_META: Record<BookingStatus, StatusMeta> = BOOKING_STATUS_META;

/**
 * Значок и цвет тела блока. У «пришёл» таблица F-01-078 различает оплачено/не оплачено —
 * у Booking своего поля «оплачено» нет (это заведует finance, F-01-061 в b02), поэтому
 * используем prepayment.paid как приближение (⚠️ допущение, см. assumed).
 */
export function statusMeta(
  booking: Pick<Booking, "status" | "prepayment">,
): StatusMeta {
  if (booking.status === "arrived" && !booking.prepayment?.paid) {
    return { tone: "warning", icon: AlertCircle };
  }
  return BASE_STATUS_META[booking.status];
}

/** Источник записи → цвет шапки (F-01-027): зелёная — создал сотрудник, фиолетовая — онлайн клиент */
export function isOnlineSource(source: BookingSource): boolean {
  return source === "app" || source === "link" || source === "widget";
}

export function headerTone(source: BookingSource): "success" | "accent" {
  return isOnlineSource(source) ? "accent" : "success";
}
