/**
 * Плата за место (⭐ F-00-013/014/016/113). Одно правило для строки списка, карточки и формы добавления (С9 обзора
 * «Сотрудники», 27.09.2026) — у каждого места есть причина, и строка показывает её словом: «Платно · мастер»,
 * «Бесплатно · без доступа», «Станет платным после входа».
 *
 * Правило (владелец 17.11.2026, ответ 19 — одно правило с сервером, в режиме api места считает сервер
 * billing-seats.ts; здесь — мок и черновик формы добавления):
 *  - уволенный и отключённый («доступ отключён») — бесплатно, места не занимают;
 *  - владелец — бесплатно, пока у него нет своих услуг И графика (тогда он работает как мастер — платно);
 *  - первый администратор — бесплатно, следующие — ADMIN_EXTRA_SEAT_PRICE;
 *  - ассистент по галочке «Ассистент» (только галочка — должность «Ассистент…» места не освобождает) без своих услуг,
 *    графика и записей в этом месяце — бесплатно; со своей услугой, графиком или записями — платный мастер;
 *  - приглашённый, ещё не вошедший мастер — бесплатно до первого входа, но не дольше INVITED_FREE_DAYS дней
 *    с приглашения (в моке — с даты добавления hiredAt);
 *  - остальные мастера — MASTER_SEAT_PRICE.
 */
import dayjs from "dayjs";
import type { Staff, StaffRole, StaffStatus, Workplace } from "@/domain/core";

export const MASTER_SEAT_PRICE = 4000;
export const ADMIN_EXTRA_SEAT_PRICE = 2000;
export const MIN_PAID_MASTERS = 2;
/** Сколько дней приглашённый, ещё не вошедший мастер не занимает платное место (ответ 19, как сервер) */
export const INVITED_FREE_DAYS = 14;

export type SeatReason =
  | "fired"
  | "noAccess"
  | "ownerFree"
  | "ownerAsMaster"
  | "adminFirstFree"
  | "adminExtra"
  | "assistantFree"
  | "assistantWorks"
  | "invitedPending"
  | "invitedLong"
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
 * scheduled — у кого есть график (владелец, работающий мастером, и ассистент); не знаем — считаем, что нет.
 * withBookings — у кого есть свои записи в этом месяце (ассистент с записями — платный мастер).
 */
export function seatsFor(
  staffOfBusiness: (Staff | SeatCandidate)[],
  scheduled: ReadonlySet<string> = new Set(),
  withBookings: ReadonlySet<string> = new Set(),
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
    if (s.assistantOnly) {
      const works = s.serviceIds.length > 0 || scheduled.has(s.id) || withBookings.has(s.id);
      return void result.set(s.id, works ? { staffId: s.id, paid: true, price: MASTER_SEAT_PRICE, reason: "assistantWorks" } : free(s.id, "assistantFree"));
    }
    if (s.status === "invited") {
      const fresh = dayjs().diff(dayjs(s.hiredAt), "day", true) < INVITED_FREE_DAYS;
      return void result.set(s.id, fresh ? free(s.id, "invitedPending") : { staffId: s.id, paid: true, price: MASTER_SEAT_PRICE, reason: "invitedLong" });
    }
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
