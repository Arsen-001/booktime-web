"use client";

/**
 * Тонкие права «Журнал записей» (8, F-01-178) и «Окно записи» (31, F-01-179) — тоньше грубых
 * journal.view/edit/create/reschedule/others фундамента (src/config/permissions.ts, просьба —
 * qa/requests/journal.md). Владелец/сеть/индивидуал видят и могут всё всегда; у администратора и
 * мастера — умолчание по роли, которое владелец может переопределить по сотруднику (override хранится
 * в JournalState.staffJournalRights / staffWindowRights по staffId, см. api/journal.ts). Тот же паттерн,
 * что src/areas/clients/lib/rights.ts.
 */
import {
  getStaffJournalRights,
  getStaffWindowRights,
} from "@/api/journal";
import { useApiQuery } from "@/api/request";
import { useCan, useCurrent, useDemo } from "@/demo/hooks";
import type { Booking } from "@/domain/core";
import { today } from "@/lib/date";
import {
  allJournalBlockRights,
  allWindowRights,
  defaultAdminJournalRights,
  defaultAdminWindowRights,
  defaultMasterJournalRights,
  defaultMasterWindowRights,
  type JournalBlockRights,
  type WindowRights,
} from "@/domain/journal";

function journalDefaultsForPersona(persona: string): JournalBlockRights {
  if (persona === "admin") return defaultAdminJournalRights();
  if (persona === "master") return defaultMasterJournalRights();
  return allJournalBlockRights();
}

function windowDefaultsForPersona(persona: string): WindowRights {
  if (persona === "admin") return defaultAdminWindowRights();
  if (persona === "master") return defaultMasterWindowRights();
  return allWindowRights();
}

export interface UseJournalBlockRightsResult extends JournalBlockRights {
  ready: boolean;
}

/** F-01-178 */
export function useJournalBlockRights(): UseJournalBlockRightsResult {
  const { persona } = useDemo();
  const { staffId, ready: currentReady } = useCurrent();
  const canOthersCoarse = useCan("journal.others");
  const canRescheduleCoarse = useCan("journal.reschedule");
  const canPhonesCoarse = useCan("clients.phones");

  const isOverridable = persona === "admin" || persona === "master";
  const q = useApiQuery(
    ["journal", "staff-rights", staffId],
    () => getStaffJournalRights(staffId!),
    { enabled: currentReady && Boolean(staffId) && isOverridable },
  );

  const owner =
    persona === "owner" || persona === "network" || persona === "individual";
  const base = journalDefaultsForPersona(persona);
  const override = isOverridable ? q.data : undefined;
  const merged: JournalBlockRights = owner
    ? allJournalBlockRights()
    : { ...base, ...override };

  // Грубые права фундамента побеждают, когда они СТРОЖЕ — тонкие права не должны их обходить.
  if (!canOthersCoarse) merged.viewStaffScope = "own";
  if (!canRescheduleCoarse) merged.reschedule = false;
  if (!canPhonesCoarse) merged.showPhones = false;

  return {
    ...merged,
    ready: !isOverridable || (currentReady && !q.isLoading),
  };
}

export interface UseWindowRightsResult extends WindowRights {
  ready: boolean;
}

/** F-01-179 */
export function useWindowRights(): UseWindowRightsResult {
  const { persona } = useDemo();
  const { staffId, ready: currentReady } = useCurrent();
  const canEditCoarse = useCan("journal.edit");
  const canCreateCoarse = useCan("journal.create");
  const canClientsViewCoarse = useCan("clients.view");
  const canClientsEditCoarse = useCan("clients.edit");
  const canPhonesCoarse = useCan("clients.phones");
  const canFinanceCoarse = useCan("finance.edit");
  const canStockCoarse = useCan("stock.edit");
  const canLoyaltyCoarse = useCan("loyalty.manage");

  const isOverridable = persona === "admin" || persona === "master";
  const q = useApiQuery(
    ["journal", "staff-window-rights", staffId],
    () => getStaffWindowRights(staffId!),
    { enabled: currentReady && Boolean(staffId) && isOverridable },
  );

  const owner =
    persona === "owner" || persona === "network" || persona === "individual";
  const base = windowDefaultsForPersona(persona);
  const override = isOverridable ? q.data : undefined;
  const merged: WindowRights = owner
    ? allWindowRights()
    : { ...base, ...override };

  if (!canEditCoarse) {
    merged.editBookings = false;
    merged.editArrivedStatus = false;
    merged.editArrivedPaid = false;
    merged.editConfirmedStatus = false;
    merged.editServicePrice = false;
    merged.editServiceDiscount = false;
    merged.changeStaffAndTime = false;
    merged.changeDuration = false;
    merged.editComment = false;
    merged.editServiceComposition = false;
  }
  if (!canCreateCoarse) merged.createBookings = false;
  if (!canClientsViewCoarse) merged.clientAccess = false;
  if (!canClientsEditCoarse) merged.createClientInWindow = false;
  if (!canPhonesCoarse) merged.showPhones = false;
  if (!canFinanceCoarse) {
    merged.takePayment = false;
    merged.takePaymentFromClientAccount = false;
  }
  if (!canStockCoarse) {
    merged.sellGoods = false;
    merged.createGoodsTx = false;
    merged.editGoodsTx = false;
    merged.editGoodsPrice = false;
    merged.editGoodsDiscount = false;
  }
  if (!canLoyaltyCoarse) merged.takePaymentFromClientAccount = false;

  return {
    ...merged,
    ready: !isOverridable || (currentReady && !q.isLoading),
  };
}

/**
 * F-01-085, F-01-179: правка/удаление ограничены статусом и оплатой. `paidAmount` — сколько уже
 * отмечено оплаченным (BookingExtras.paidAmount), не Booking сама по себе.
 */
export function canEditBooking(
  booking: Pick<Booking, "status"> | undefined,
  paidAmount: number,
  rights: WindowRights,
): boolean {
  if (!booking) return rights.createBookings;
  if (!rights.editBookings) return false;
  const isPaid = paidAmount > 0;
  if (booking.status === "arrived" && isPaid) return rights.editArrivedPaid;
  if (booking.status === "arrived") return rights.editArrivedStatus;
  if (booking.status === "client_confirmed") return rights.editConfirmedStatus;
  return true;
}

export function canDeleteBooking(
  booking: Pick<Booking, "status"> | undefined,
  paidAmount: number,
  rights: WindowRights,
): boolean {
  if (!booking) return false;
  if (!rights.deleteBookings) return false;
  const isPaid = paidAmount > 0;
  if (isPaid) return rights.deletePaidBookings;
  if (booking.status === "arrived") return rights.deleteArrivedBookings;
  return true;
}

/** F-01-178/179: маска телефона, например «+3123XXXXX90» (справка 1281) */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "••• ••• ••";
  const head = digits.slice(0, digits.length - 7);
  const tail = digits.slice(-2);
  return `+${head}${"X".repeat(5)}${tail}`;
}

/** F-01-180: сколько дней в прошлое разрешено правило historyLimit; null = без ограничения */
export function historyLimitDays(limit: JournalBlockRights["historyLimit"]): number | null {
  switch (limit) {
    case "none":
      return 0;
    case "1d":
      return 1;
    case "3d":
      return 3;
    case "7d":
      return 7;
    case "1m":
      return 30;
    case "3m":
      return 90;
    case "6m":
      return 182;
    default:
      return null;
  }
}

/** true — дата раньше разрешённого окна прошлого (F-01-180) */
export function isBeyondHistoryLimit(
  dateIso: string,
  limit: JournalBlockRights["historyLimit"],
  todayIso: string,
): boolean {
  const days = historyLimitDays(limit);
  if (days === null) return false;
  const diffMs = new Date(todayIso).getTime() - new Date(dateIso).getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  return diffDays > days;
}

export function useIsBeyondHistoryLimit(dateIso: string): boolean {
  const rights = useJournalBlockRights();
  // qa/measure/journal/ux-r1.md: UTC-дата здесь сдвигала бы границу истории на час назад для
  // всех в Ереване (UTC+4) с полуночи до 4 утра — тот же класс ошибки, что чинили в JournalToolbar;
  // `today()` из `@/lib/date` считает по местному (ереванскому) дню.
  const todayIso = today();
  return isBeyondHistoryLimit(dateIso, rights.historyLimit, todayIso);
}

/**
 * F-01-178 (qa/full-test-0930/journal-perms.md): чьи записи видно. `ownOnlyStaffId === undefined` — всех мастеров;
 * иначе только записи этого сотрудника (нет journal.others или тонкое «видеть только свои»). То же правило, что у
 * сетки (JournalScreen) — для поиска, окна записи по ссылке и «Записей». Работает одинаково в mock и api режиме.
 */
export function useJournalStaffScope(): { ready: boolean; ownOnlyStaffId: string | undefined } {
  const { staffId } = useCurrent();
  const canSeeOthers = useCan("journal.others");
  const rights = useJournalBlockRights();
  const all = canSeeOthers && rights.viewStaffScope === "all";
  return { ready: rights.ready, ownOnlyStaffId: all ? undefined : (staffId ?? "") };
}
