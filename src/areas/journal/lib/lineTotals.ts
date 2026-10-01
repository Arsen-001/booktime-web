/**
 * Строки визита в окне записи (F-01-058, F-01-060, F-01-211): считаем «Итог» строки услуги/товара
 * и общую сумму «К оплате» (F-01-061). Отдельный чистый модуль — удобно проверить формулу без UI.
 */
import type { Id, Minutes, Money } from "@/domain/core";
import type { ServiceAssistant } from "@/domain/journal";

export interface UiServiceLine {
  serviceId: Id;
  staffId: Id;
  name: string;
  durationMin: Minutes;
  qty: number;
  unitPrice: Money;
  discountPct: number;
  /** F-01-059 */
  assistants?: ServiceAssistant[];
  /** F-16-125/130: строка пришла из пакета, добавленного в окно (убирается вместе с пакетом) */
  packageId?: Id;
  /**
   * F-01-094: срок «повторного визита» на эту услугу для ЭТОЙ записи — переопределяет интервал
   * «пора снова» услуги (F-00-084/119) только у данного визита. Коды по справке: дни (1-30),
   * недели (5-20), месяцы (2-6, 12); `undefined` — берётся из настроек услуги как есть.
   */
  repeatReminder?: RepeatReminderCode;
  /** ⭐ Допродажа: строка добавлена как сопутствующая к этой услуге (онлайн клиентом или подсказкой окна) */
  upsellOf?: Id;
}

/** F-01-094: варианты срока повторного визита по справке — 1-30 дней / 5-20 недель / 2-6 или 12 месяцев */
export type RepeatReminderCode = `d${number}` | `w${number}` | `m${number}`;

/** F-01-094: готовый список опций для Select — фиксированный набор, не диапазон на каждое число */
export const REPEAT_REMINDER_OPTIONS: RepeatReminderCode[] = [
  "d1",
  "d3",
  "d7",
  "d14",
  "d30",
  "w5",
  "w10",
  "w20",
  "m2",
  "m3",
  "m6",
  "m12",
];

export interface UiGoodsLine {
  id: Id;
  itemId: Id;
  name: string;
  qty: number;
  unitPrice: Money;
  discountPct: number;
  sellerId: Id;
  code?: string;
  qtyLocked: boolean;
  /** ⭐ Допродажа: товар взят как сопутствующий к этой услуге */
  upsellOf?: Id;
}

function round(value: number): number {
  return Math.round(value);
}

export function serviceLineTotal(
  line: Pick<UiServiceLine, "unitPrice" | "qty" | "discountPct">,
): Money {
  return round(line.unitPrice * line.qty * (1 - line.discountPct / 100));
}

export function goodsLineTotal(
  line: Pick<UiGoodsLine, "unitPrice" | "qty" | "discountPct">,
): Money {
  return round(line.unitPrice * line.qty * (1 - line.discountPct / 100));
}

export function visitTotal(
  services: UiServiceLine[],
  goods: UiGoodsLine[],
): Money {
  return (
    services.reduce((sum, l) => sum + serviceLineTotal(l), 0) +
    goods.reduce((sum, l) => sum + goodsLineTotal(l), 0)
  );
}
