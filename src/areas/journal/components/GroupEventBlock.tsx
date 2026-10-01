"use client";

/**
 * Блок группового события в сетке журнала (F-01-035): показывает занятие с местами, значок серии.
 * Само окно события (участники, редактирование серии) — раздел `resources`, `/biz/groups` (не наш
 * маршрут); блок здесь только открывает его по ссылке, см. qa/requests/journal.md (2026-09-25, g2-1).
 * F-16-042: значок серии несёт дату окончания расписания, отдельный значок — у события, изменённого
 * отдельно от серии (`EventSeriesDef.uniqueEventIds`, раздел `resources`, `src/api/resources.ts`).
 */
import { useLocale } from "next-intl";
import { PenLine, Repeat, Users } from "lucide-react";
import type { GroupEvent, ISODate, Service } from "@/domain/core";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { pickText } from "@/lib/text";

export interface GroupEventBlockProps {
  event: GroupEvent;
  service?: Service;
  participantCount: number;
  top: number;
  height: number;
  onOpen: () => void;
  /** F-16-042: дата окончания расписания серии — показывается рядом со значком повтора */
  seriesEndDate?: ISODate;
  /** F-16-042: это событие серии изменено отдельно и больше не следует общему расписанию */
  modifiedFromSeries?: boolean;
}

export function GroupEventBlock({
  event,
  service,
  participantCount,
  top,
  height,
  onOpen,
  seriesEndDate,
  modifiedFromSeries,
}: GroupEventBlockProps) {
  const t = useT("journal");
  const f = useFormat();
  const locale = useLocale();
  const full = participantCount >= event.capacity;
  const cancelled = event.status === "cancelled";

  return (
    <button
      type="button"
      data-f="F-01-035 F-00-185"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      style={{ top, height, left: 2, right: 2 }}
      className={cn(
        "absolute z-10 flex flex-col justify-between gap-0.5 rounded-lg border px-2 py-1 text-left text-xs shadow-sm transition-colors",
        cancelled
          ? "border-border bg-surface-3/70 text-muted line-through"
          : full
            ? "border-warning/60 bg-warning-soft text-fg hover:brightness-95"
            : "border-chart-4/50 bg-chart-4/10 text-fg hover:brightness-95",
      )}
    >
      <span className="flex items-center gap-1 font-medium">
        <Users aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">
          {service ? pickText(service.name, locale) : t("grid.groupEvent")}
        </span>
        {event.seriesId && (
          <span
            data-f="F-16-042"
            className="flex shrink-0 items-center gap-0.5 text-muted"
            aria-label={
              seriesEndDate
                ? t("grid.groupEventSeriesUntil", { date: f.date(seriesEndDate, "dayMonth") })
                : undefined
            }
          >
            <Repeat aria-hidden className="size-3" data-f="F-01-217" />
            {seriesEndDate && (
              <span className="hidden text-[10px] leading-none sm:inline">
                {t("grid.groupEventSeriesUntilShort", { date: f.date(seriesEndDate, "dayMonth") })}
              </span>
            )}
          </span>
        )}
        {modifiedFromSeries && (
          <PenLine
            aria-label={t("grid.groupEventModified")}
            data-f="F-16-042"
            className="size-3 shrink-0 text-warning"
          />
        )}
      </span>
      <span className={cn("text-[11px]", full ? "font-medium text-warning" : "text-muted")}>
        {t("grid.groupEventCapacity", {
          count: participantCount,
          capacity: event.capacity,
        })}
      </span>
    </button>
  );
}
