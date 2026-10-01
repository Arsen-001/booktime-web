"use client";

/**
 * Ячейки строки сотрудника — одни и те же в таблице компьютера и в строке телефона:
 *  - место в лицензии словом с причиной (С9): «Платно · мастер», «Бесплатно · без доступа»;
 *  - график до какого дня (С8): «до 27.10», красным — «нет графика» / «закончился»;
 *  - число услуг ссылкой на вкладку «Услуги» карточки (С8);
 *  - контакты: телефон в формате «+374 00 110 002», почта второй строкой (С10).
 */
import Link from "next/link";
import type { StaffListRow } from "@/api/staff";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { today } from "@/lib/date";
import { cn } from "@/lib/cn";

/** stacked — в таблице: «Платно» и причина двумя строками, колонка узкая */
export function SeatLabel({ seat, className, stacked = false }: { seat: StaffListRow["seat"]; className?: string; stacked?: boolean }) {
  const t = useT("staff");
  if (seat.reason === "invitedPending")
    return <span className={cn("text-sm text-muted", className)}>{t("seat.invitedPending")}</span>;
  return (
    <span className={cn("text-sm", stacked && "flex flex-col leading-tight", className)}>
      <span className={seat.paid ? "font-medium text-fg" : "font-medium text-success"}>
        {seat.paid ? t("seat.paid") : t("seat.free")}
      </span>
      {seat.reason && (
        <span className={cn("text-muted", stacked && "text-[13px]")}>
          {stacked ? "" : " · "}
          {t(`seat.reason.${seat.reason}` as never)}
        </span>
      )}
    </span>
  );
}

export function ScheduleCell({ until, className }: { until: string | null; className?: string }) {
  const t = useT("staff");
  const fmt = useFormat();
  if (until === null)
    return <span className={cn("text-sm font-medium text-danger", className)}>{t("table.noSchedule")}</span>;
  if (until >= "9999") return <span className={cn("text-sm text-muted", className)}>{t("table.scheduleOpen")}</span>;
  const short = fmt.date(until, "short").slice(0, 5);
  if (until < today())
    return (
      <span className={cn("text-sm font-medium text-danger", className)}>
        {t("table.scheduleEnded", { date: short })}
      </span>
    );
  return <span className={cn("text-sm text-fg tabular-nums", className)}>{t("table.scheduleUntil", { date: short })}</span>;
}

export function ServicesCell({ row, className }: { row: StaffListRow; className?: string }) {
  const t = useT("staff");
  const n = row.servicesCount;
  return (
    <Link
      href={`/biz/staff/${row.staff.id}?tab=services`}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "-mx-1 inline-flex min-h-8 items-center rounded-md px-1 text-sm hover:underline focus-visible:outline-2 focus-visible:outline-focus",
        n === 0 ? "font-medium text-danger" : "text-primary-text",
        className,
      )}
    >
      {n === 0 ? t("table.noServices") : t("table.servicesCount", { n })}
    </Link>
  );
}

export function ContactsCell({ row }: { row: StaffListRow }) {
  const fmt = useFormat();
  const { phone, email } = row.staff;
  if (!phone && !email) return <span className="text-muted">—</span>;
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      {phone && <span className="whitespace-nowrap tabular-nums text-fg">{fmt.phone(phone)}</span>}
      {email && <span className="truncate text-[13px] text-muted">{email}</span>}
    </span>
  );
}
