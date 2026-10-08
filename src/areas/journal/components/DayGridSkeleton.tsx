"use client";

/**
 * Скелетон сетки дня — та же разметка, что у DayGrid (DESIGN.md → «The skeleton IS the page»): белая карточка r16,
 * липкая шапка колонок h-16 (аватар, имя, полоса загрузки, «N записей»), колонка часов 52px, линии часов через 96px,
 * линия «сейчас». Приехали данные — на месте полос встают имена и появляются карточки записей; рамка, шапка и линии
 * не двигаются.
 *
 * Число колонок и диапазон часов — как в прошлый раз на этом экране (useRememberedLayout), иначе типичный день демо:
 * 4 мастера, 10:00–20:00.
 */
import { useEffect } from "react";
import type { ISODate } from "@/domain/core";
import type { JournalZoomMin } from "@/domain/journal";
import { cn } from "@/lib/cn";
import { hourTicks, minutesToTop, rangeHeightPx, type DayRange } from "@/areas/journal/lib/grid";
import { NowLine } from "@/areas/journal/components/NowLine";
import { renderedJournalStyle } from "@/areas/journal/lib/journalStyle";
import { Skeleton, SkeletonText } from "@/ui/Skeleton";
import { useRememberedLayout } from "@/ui/hooks/useSkeletonCount";

const GUTTER = 52;
/** Типичный день демо: 4 мастера в графике, смены 10:00–20:00 */
const FALLBACK = { columns: 4, startMin: 10 * 60, endMin: 20 * 60 };
const NAME_WIDTHS = ["13ch", "15ch", "14ch", "12ch", "13ch", "11ch"];
const NAME_WIDTHS_SHORT = ["6ch", "7ch", "6ch", "5ch", "6ch", "5ch"];

export interface DayGridShape {
  columns: number;
  startMin: number;
  endMin: number;
}

/**
 * Раскладка сетки для скелетона: [прошлая или типичная, запомнить]. Запоминать — когда сетка с данными на экране:
 *   const [shape, saveShape] = useDayGridShape(); useEffect(() => { if (!loading) saveShape(...) });
 */
export function useDayGridShape(): [DayGridShape, (shape: DayGridShape) => void] {
  const [remembered, save] = useRememberedLayout<DayGridShape>("day-grid");
  const ok = remembered && remembered.columns > 0 && remembered.endMin > remembered.startMin;
  return [ok ? remembered : FALLBACK, save];
}

/** Запомнить раскладку сетки с данными (колонки и диапазон часов) — для скелетона следующего захода */
export function useSaveDayGridShape(save: (shape: DayGridShape) => void, shape: DayGridShape | null): void {
  // Запись в память сама пропускает неизменившееся значение
  useEffect(() => {
    if (shape) save(shape);
  });
}

export interface DayGridSkeletonProps {
  date: ISODate;
  shape: DayGridShape;
  zoomMin: JournalZoomMin;
  /** Телефон: сколько колонок на экран (как у DayGrid) */
  columnsPerScreen?: number;
  className?: string;
}

export function DayGridSkeleton({ date, shape, zoomMin, columnsPerScreen, className }: DayGridSkeletonProps) {
  const range: DayRange = { startMin: shape.startMin, endMin: shape.endMin };
  const ticks = hourTicks(range);
  const heightPx = rangeHeightPx(range, zoomMin);
  const columnWidth = columnsPerScreen ? `calc((100cqw - ${GUTTER}px) / ${columnsPerScreen})` : undefined;
  const colStyle = columnWidth ? { width: columnWidth, minWidth: columnWidth } : undefined;
  const colClass = columnsPerScreen ? "shrink-0 snap-start" : "min-w-[200px] flex-1";
  const minWidth = columnsPerScreen ? `calc(${shape.columns} * ${columnWidth} + ${GUTTER}px)` : shape.columns * 200 + GUTTER;
  const cols = Array.from({ length: shape.columns }, (_, i) => i);

  return (
    <div aria-busy className={cn("relative flex min-h-0 flex-col", className)}>
      <div
        className={cn(
          "scrollbar-thin min-h-0 flex-1 overflow-auto overscroll-contain bg-surface pb-24 md:pb-0",
          renderedJournalStyle() === "booktime" ? "rounded-2xl border border-border" : "border-t border-border",
          columnsPerScreen && "@container snap-x scroll-pl-[52px]",
        )}
      >
        <div style={{ minWidth }}>
          <div className="sticky top-0 z-30 flex border-b border-border bg-surface">
            <div className="sticky left-0 z-10 shrink-0 bg-surface" style={{ width: GUTTER }} />
            {cols.map((i) => (
              <div key={i} className={cn("flex h-16 items-center gap-2.5 border-l border-line px-3", colClass)} style={colStyle}>
                <Skeleton variant="circle" className={cn("shrink-0", columnsPerScreen ? "size-6" : "size-8")} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="min-w-0">
                    <span className="-mx-1 flex min-h-10 max-w-full items-center gap-1 px-1 text-sm font-semibold">
                      <SkeletonText width={(columnsPerScreen ? NAME_WIDTHS_SHORT : NAME_WIDTHS)[i % NAME_WIDTHS.length]} />
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="relative hidden h-1 w-16 overflow-hidden rounded-full bg-surface-3 lg:block" />
                    <span className="truncate text-xs text-muted">
                      <SkeletonText width="9ch" />
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="relative flex">
            <div className="sticky left-0 z-20 shrink-0 bg-surface" style={{ width: GUTTER, height: heightPx }}>
              {ticks.slice(1).map((m) => (
                <span
                  key={m}
                  style={{ top: minutesToTop(m, range, zoomMin) }}
                  className="absolute right-2 -translate-y-1/2 text-[11px] text-muted tabular-nums select-none"
                >
                  <SkeletonText width="4.5ch" />
                </span>
              ))}
              <NowLine date={date} range={range} zoomMin={zoomMin} variant="pill" />
            </div>
            {cols.map((i) => (
              <div key={i} className={cn("border-l border-line", colClass)} style={colStyle}>
                <div className="relative" style={{ height: heightPx }}>
                  {ticks.slice(1).map((m) => (
                    <div
                      key={m}
                      style={{ top: minutesToTop(m, range, zoomMin) }}
                      className="pointer-events-none absolute inset-x-0 border-t border-line"
                    />
                  ))}
                </div>
              </div>
            ))}
            <div className="pointer-events-none absolute inset-y-0 right-0" style={{ left: GUTTER }}>
              <NowLine date={date} range={range} zoomMin={zoomMin} />
            </div>
          </div>
        </div>
      </div>
      {columnsPerScreen && shape.columns > columnsPerScreen && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-40 w-6 rounded-r-2xl bg-gradient-to-l from-surface to-transparent" />
      )}
    </div>
  );
}
