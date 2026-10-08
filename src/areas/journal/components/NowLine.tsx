"use client";

/**
 * Линия текущего времени (F-01-023): 2px цвета danger через всю сетку с точкой слева, как в Google Calendar
 * (owner 08.10.2026). Обновляется раз в минуту; двигается через transform (translateY), без перерисовки сетки.
 */
import { useEffect, useState } from "react";
import type { ISODate } from "@/domain/core";
import type { DayRange } from "@/areas/journal/lib/grid";
import { minutesToTop } from "@/areas/journal/lib/grid";
import { useJournalHourFormat } from "@/areas/journal/lib/useJournalHourFormat";
import type { JournalZoomMin } from "@/domain/journal";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { today } from "@/lib/date";

export interface NowLineProps {
  date: ISODate;
  range: DayRange;
  zoomMin: JournalZoomMin;
}

export function NowLine({ date, range, zoomMin }: NowLineProps) {
  const [now, setNow] = useState<Date | null>(null);
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const t = useT("journal");

  useEffect(() => {
    const tick = () => setNow(new Date());
    // Первое значение — асинхронно (таймер), не синхронно в теле эффекта (purity/set-state-in-effect)
    const kickoff = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, []);

  if (!now || date !== today()) return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < range.startMin || minutes > range.endMin) return null;
  const top = minutesToTop(minutes, range, zoomMin);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const label = format.time(`${date}T${hh}:${mm}`);

  // Как у Google Calendar (08.10.2026): красная линия с точкой у левого края; время — в подписи для чтения с экрана
  return (
    <div
      role="img"
      aria-label={t("board.now", { time: label })}
      style={{ transform: `translateY(${top}px)` }}
      className="pointer-events-none absolute inset-x-0 top-0 z-20 -mt-px h-0.5 bg-danger before:absolute before:-top-[5px] before:-left-1.5 before:size-3 before:rounded-full before:bg-danger before:content-['']"
    />
  );
}
