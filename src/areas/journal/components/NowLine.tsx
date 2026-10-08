"use client";

/**
 * Линия текущего времени (F-01-023): 2px цвета danger через всю сетку, слева — «пилюля» со временем в колонке часов
 * (DESIGN.md → Journal A2). Обновляется раз в минуту; двигается через transform (translateY), без перерисовки сетки.
 */
import { TimeText } from '@/areas/journal/components/TimeText';
import { useEffect, useState } from "react";
import type { ISODate } from "@/domain/core";
import type { DayRange } from "@/areas/journal/lib/grid";
import { minutesToTop } from "@/areas/journal/lib/grid";
import { useJournalHourFormat } from "@/areas/journal/lib/useJournalHourFormat";
import { renderedJournalStyle } from "@/areas/journal/lib/journalStyle";
import type { JournalZoomMin } from "@/domain/journal";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { today } from "@/lib/date";

export interface NowLineProps {
  date: ISODate;
  range: DayRange;
  zoomMin: JournalZoomMin;
  /** line — сама линия (в теле сетки); pill — время в колонке часов (она прилипает слева при прокрутке вбок) */
  variant?: "line" | "pill";
}

export function NowLine({ date, range, zoomMin, variant = "line" }: NowLineProps) {
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

  const style = renderedJournalStyle();
  const google = style === "google";
  if (variant === "pill" && google) return null;
  // «Календарь iOS»: красное время у оси без плашки (фон прячет подпись часа под ним)
  if (variant === "pill" && style === "ios")
    return (
      <span
        role="img"
        aria-label={t("board.now", { time: label })}
        style={{ transform: `translateY(${top}px)` }}
        className="pointer-events-none absolute top-0 right-1 z-20 -mt-2 bg-surface px-0.5 text-[11px] leading-4 font-semibold text-danger tabular-nums"
      >
        <TimeText value={label} suffixClassName="text-[10px]" />
      </span>
    );
  if (variant === "pill")
    return (
      <span
        role="img"
        aria-label={t("board.now", { time: label })}
        style={{ transform: `translateY(${top}px)` }}
        className="pointer-events-none absolute top-0 left-1 z-20 -mt-2.5 rounded-md bg-danger px-1.5 text-[11px] leading-5 font-bold text-primary-contrast tabular-nums"
      >
        <TimeText value={label} suffixClassName="text-[10px]" />
      </span>
    );

  if (style === "ios")
    return (
      <div
        aria-hidden
        style={{ transform: `translateY(${top}px)` }}
        className="pointer-events-none absolute inset-x-0 top-0 z-20 -mt-px h-0.5 bg-danger before:absolute before:-top-[3px] before:-left-1 before:size-2 before:rounded-full before:bg-danger before:content-['']"
      />
    );
  // Стиль «Google Calendar» (08.10.2026): пилюли со временем нет — линия с точкой у левого края, время в подписи
  if (google)
    return (
      <div
        role="img"
        aria-label={t("board.now", { time: label })}
        style={{ transform: `translateY(${top}px)` }}
        className="pointer-events-none absolute inset-x-0 top-0 z-20 -mt-px h-0.5 bg-danger before:absolute before:-top-[5px] before:-left-1.5 before:size-3 before:rounded-full before:bg-danger before:content-['']"
      />
    );
  return (
    <div
      aria-hidden
      style={{ transform: `translateY(${top}px)` }}
      className="pointer-events-none absolute inset-x-0 top-0 z-20 -mt-px h-0.5 bg-danger"
    />
  );
}
