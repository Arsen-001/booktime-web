"use client";

/** Мини-календарь месяца с загрузкой дней (F-01-003, F-01-004). */
import { useMemo, useState } from "react";
import type { Id, ISODate } from "@/domain/core";
import { getRangeLoad } from "@/api/journal";
import { useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { parse, toISODate } from "@/lib/date";
import {
  Calendar,
  type CalendarDayMeta,
  type CalendarDayTone,
} from "@/ui/Calendar";
import { Skeleton } from "@/ui/Skeleton";

export interface MiniCalendarPanelProps {
  value: ISODate;
  onValueChange: (date: ISODate) => void;
  staffIds: Id[];
}

function loadTone(ratio: number): CalendarDayTone {
  if (ratio > 0.8) return "danger";
  if (ratio > 0.5) return "warning";
  return "success";
}

export function MiniCalendarPanel({
  value,
  onValueChange,
  staffIds,
}: MiniCalendarPanelProps) {
  const t = useT("journal");
  const [month, setMonth] = useState(() => value.slice(0, 7) + "-01");
  const range = useMemo(() => {
    const start = parse(month).subtract(7, "day");
    const end = parse(month).add(1, "month").add(7, "day");
    return { from: toISODate(start), to: toISODate(end) };
  }, [month]);

  const q = useApiQuery(
    ["journal", "range-load", staffIds.join(","), range.from, range.to],
    () => getRangeLoad(staffIds, range.from, range.to),
  );

  const dayMeta = (date: ISODate): CalendarDayMeta | undefined => {
    const load = q.data?.[date];
    if (!load) return undefined;
    if (!load.hasSchedule) return { label: t("miniCalendar.noSchedule") };
    // Пустой (0%) день — без кольца, как непустой отличаем dot-ом (Calendar не умеет рисовать дугу)
    if (load.ratio <= 0) return undefined;
    return {
      tone: loadTone(load.ratio),
      dot: true,
      label: t("miniCalendar.loadPercent", {
        pct: Math.round(load.ratio * 100),
      }),
    };
  };

  return (
    <div
      data-f="F-01-003 F-01-004 F-12-043 F-02-031"
      aria-busy={q.isLoading || undefined}
    >
      {q.isLoading && !q.data ? (
        <Skeleton variant="rect" className="h-64 w-full rounded-xl" />
      ) : (
        <Calendar
          value={value}
          onValueChange={onValueChange}
          month={month}
          onMonthChange={setMonth}
          dayMeta={dayMeta}
        />
      )}
    </div>
  );
}
