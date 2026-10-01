/**
 * Плата за место (⭐ F-00-013/014/016/113). Одно правило для строки списка, карточки и формы добавления (С9 обзора
 * «Сотрудники», 27.09.2026) — у каждого места есть причина, и строка показывает её словом: «Платно · мастер»,
 * «Бесплатно · без доступа», «Станет платным после входа».
 *
 * Правило (наше решение, совпадает с расчётом подписки в settings — computeSeats):
 *  - уволенный и отключённый («доступ отключён») — бесплатно, места не занимают;
 *  - владелец — бесплатно, пока у него нет своих услуг И графика (тогда он работает как мастер — платно);
 *  - первый администратор — бесплатно, следующие — ADMIN_EXTRA_SEAT_PRICE;
 *  - ассистент (галочка в карточке или должность «Ассистент…», isAssistantStaff) — бесплатно;
 *  - приглашённый мастер, который ещё не принял приглашение, — бесплатно до первого входа;
 *  - остальные мастера — MASTER_SEAT_PRICE.
 */
import type { Staff, StaffRole, StaffStatus, Workplace } from "@/domain/core";
import { isAssistantStaff } from "@/domain/staff";

export const MASTER_SEAT_PRICE = 4000;
export const ADMIN_EXTRA_SEAT_PRICE = 2000;
export const MIN_PAID_MASTERS = 2;

export type SeatReason =
  | "fired"
  | "noAccess"
  | "ownerFree"
  | "ownerAsMaster"
  | "adminFirstFree"
  | "adminExtra"
  | "assistantFree"
  | "invitedPending"
  | "master";

export interface SeatInfo {
  staffId: string;
  paid: boolean;
  price: number;
  reason?: SeatReason;
}

/** Минимальная форма сотрудника, достаточная для расчёта места (позволяет считать и черновик формы добавления) */
export interface SeatCandidate {
  id: string;
  role: StaffRole;
  status: StaffStatus;
  workplaces: Workplace[];
  serviceIds: string[];
  hiredAt: string;
  assistantOnly?: boolean;
  position?: Staff["position"];
}

const free = (staffId: string, reason: SeatReason): SeatInfo => ({ staffId, paid: false, price: 0, reason });

/**
 * Считает место каждого сотрудника бизнеса разом (порядок по hiredAt задаёт «кто первый администратор»).
 * scheduled — у кого есть график (нужно только для владельца, работающего мастером); не знаем — считаем, что нет.
 */
export function seatsFor(
  staffOfBusiness: (Staff | SeatCandidate)[],
  scheduled: ReadonlySet<string> = new Set(),
): Map<string, SeatInfo> {
  const result = new Map<string, SeatInfo>();
  const admins = staffOfBusiness
    .filter((s) => s.role === "admin" && s.status !== "fired" && s.status !== "disabled")
    .sort((a, b) => a.hiredAt.localeCompare(b.hiredAt));
  staffOfBusiness.forEach((s) => {
    if (s.status === "fired") return void result.set(s.id, free(s.id, "fired"));
    if (s.status === "disabled") return void result.set(s.id, free(s.id, "noAccess"));
    if (s.role === "owner") {
      const asMaster = s.serviceIds.length > 0 && scheduled.has(s.id);
      return void result.set(
        s.id,
        asMaster ? { staffId: s.id, paid: true, price: MASTER_SEAT_PRICE, reason: "ownerAsMaster" } : free(s.id, "ownerFree"),
      );
    }
    if (s.role === "admin") {
      const isFirst = admins[0]?.id === s.id;
      return void result.set(
        s.id,
        isFirst ? free(s.id, "adminFirstFree") : { staffId: s.id, paid: true, price: ADMIN_EXTRA_SEAT_PRICE, reason: "adminExtra" },
      );
    }
    if (isAssistantStaff(s)) return void result.set(s.id, free(s.id, "assistantFree"));
    if (s.status === "invited") return void result.set(s.id, free(s.id, "invitedPending"));
    result.set(s.id, { staffId: s.id, paid: true, price: MASTER_SEAT_PRICE, reason: "master" });
  });
  return result;
}

/** Сумма подписки по местам — для счётчика в форме добавления (F-10-017) и «как изменится сумма» (F-10-113) */
export function totalSeatCost(seats: Iterable<SeatInfo>): number {
  let sum = 0;
  for (const s of seats) sum += s.price;
  return sum;
}
