"use client";

/**
 * Вид «Неделя»: 7 дней одного сотрудника (F-01-013, F-01-023) или одного ресурса (F-16-020).
 * По справке неделя строится по одному сотруднику ИЛИ одному ресурсу (1373) — оба случая ведёт этот
 * компонент через общий `subject`, а не два похожих файла: у ресурса нет рабочего графика (как и в
 * дневной сетке, DayGrid.tsx, ресурсные колонки всегда «открыты» весь диапазон дня) и записи ищутся
 * по `resourceIds`, а не `staffId`.
 */
import { TimeText } from '@/areas/journal/components/TimeText';
import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useLocale } from "next-intl";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Booking, Client, DayHours, Id, ISODate, Resource, Service, Staff } from "@/domain/core";
import {
  getBookingCategories,
  getWeekHours,
  hasOverlap,
  hasResourceOverlap,
  listBookingExtrasByIds,
  listBookingLacquers,
} from "@/api/journal";
import { listBookings, updateBooking } from "@/api/core";
import { prefetchApiQuery, useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import {
  eachDay,
  fromMinutes,
  parse,
  toISODate,
  today,
  weekStart as weekStartOf,
} from "@/lib/date";
import { BookingBlock } from "@/areas/journal/components/BookingBlock";
import { NowLine } from "@/areas/journal/components/NowLine";
import { renderedJournalStyle } from "@/areas/journal/lib/journalStyle";
import {
  computeDayRange,
  hourTicks,
  hoursToBands,
  minutesToTop,
  pxPerMin,
  rangeHeightPx,
  yToTime,
} from "@/areas/journal/lib/grid";
import { isNewClientBooking } from "@/areas/journal/lib/heuristics";
import { bookingTone, cardSizes, isActiveBooking } from "@/areas/journal/lib/board";
import { useNowMinuteYerevan } from "@/areas/journal/lib/lateness";
import { cardLabels, cardText } from "@/areas/journal/lib/cardText";
import { useBookingStatusLabel } from "@/ui/BookingStatusBadge";
import type { FirstLineMode } from "@/domain/journal";
import { useJournalHourFormat } from "@/areas/journal/lib/useJournalHourFormat";
import type { JournalZoomMin } from "@/domain/journal";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/ui/Skeleton";
import { ErrorState } from "@/ui/ErrorState";
import { useToast } from "@/ui/Toast";

/** F-16-020: подпись колонки-недели — сотрудник или экземпляр ресурса. */
export type WeekSubject =
  | { kind: "staff"; staff: Staff }
  | { kind: "resource"; resource: Resource; instanceId: Id; instanceName: string };

export interface WeekGridProps {
  date: ISODate;
  businessId: Id;
  subject: WeekSubject;
  clientsById: Record<Id, Client>;
  services: Service[];
  zoomMin: JournalZoomMin;
  canCreate: boolean;
  onCreate: (date: ISODate, time: string) => void;
  onOpen: (bookingId: Id) => void;
  /** F-01-171 / F-01-178 — один раз на сетку, не в каждой карточке */
  firstLineMode: FirstLineMode;
  showPhones: boolean;
}

/**
 * Неделя мастера — заранее в кэш (JournalScreen зовёт в простое, пока открыт день): «День → Неделя» показывает
 * неделю сразу, без скелетона на месте сетки. Ключи и чтение — те же, что у запросов WeekGrid ниже.
 */
export function prefetchStaffWeek(staffId: Id, date: ISODate) {
  const start = weekStartOf(date);
  const end = toISODate(parse(start).add(6, "day"));
  prefetchApiQuery(["journal", "week-hours", staffId, start, "staff"], () => getWeekHours(staffId, start));
  prefetchApiQuery(["journal", "week-bookings", staffId, start, "staff"], () => listBookings({ staffId, from: start, to: end }));
}

export function WeekGrid({
  date,
  businessId,
  subject,
  clientsById,
  services,
  zoomMin,
  canCreate,
  onCreate,
  onOpen,
  firstLineMode,
  showPhones,
}: WeekGridProps) {
  // Стиль, которым рисуется доска (lib/journalStyle): при смене стиля JournalScreen перемонтирует её
  const style = renderedJournalStyle();
  const google = style === "google";
  const ios = style === "ios";
  const live = style === "live";
  // «Живой день»: прошедшее приглушено, идущий визит — с прогрессом (минута «сейчас» по Еревану)
  const nowMin = useNowMinuteYerevan(today());
  const phaseOf = (day: string, booking: Booking) => {
    if (!live) return undefined;
    const now = today();
    if (day < now) return { phase: "past" as const, pct: 0 };
    if (day > now || nowMin === null) return { phase: "future" as const, pct: 0 };
    const from = Number(booking.start.slice(11, 13)) * 60 + Number(booking.start.slice(14, 16));
    const to = from + booking.durationMin;
    if (to <= nowMin || !isActiveBooking(booking)) return { phase: "past" as const, pct: 0 };
    if (from <= nowMin) return { phase: "now" as const, pct: ((nowMin - from) / booking.durationMin) * 100 };
    return { phase: "future" as const, pct: 0 };
  };
  const t = useT("journal");
  const tc = useT("common");
  const toast = useToast();
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const locale = useLocale();
  const statusLabel = useBookingStatusLabel();
  const labels = useMemo(() => cardLabels(t, format), [t, format]);
  // Колбэки карточек стабильны (memo карточек не сбивается перерисовкой экрана журнала)
  const latestOpen = useRef(onOpen);
  useLayoutEffect(() => {
    latestOpen.current = onOpen;
  });
  const openById = useMemo(() => (id: Id) => latestOpen.current(id), []);
  const start = weekStartOf(date);
  const end = toISODate(parse(start).add(6, "day"));
  const days = eachDay(start, end);
  const isStaff = subject.kind === "staff";
  const subjectId = isStaff ? subject.staff.id : subject.instanceId;

  const hoursQuery = useApiQuery(
    ["journal", "week-hours", subjectId, start, subject.kind],
    () =>
      isStaff
        ? getWeekHours(subject.staff.id, start)
        : Promise.resolve(
            days.reduce<Record<ISODate, DayHours>>((acc, day) => {
              // Ресурс не ведёт график работы (как в DayGrid) — весь день считается «открытым».
              acc[day] = [{ from: "00:00", to: "23:59" }];
              return acc;
            }, {}),
          ),
  );
  const bookingsQuery = useApiQuery(
    ["journal", "week-bookings", subjectId, start, subject.kind],
    async () => {
      if (isStaff) return listBookings({ staffId: subject.staff.id, from: start, to: end });
      const all = await listBookings({ businessId, from: start, to: end });
      return all.filter((b) => b.resourceIds.includes(subject.instanceId));
    },
  );
  // F-01-028/051/052: ручной цвет и категории записи — один запрос на всю неделю, не по блоку.
  const bookingIds = (bookingsQuery.data ?? []).map((b) => b.id);
  const extrasQuery = useApiQuery(
    ["journal", "week-extras", subjectId, start, bookingIds.join(",")],
    () => listBookingExtrasByIds(bookingIds),
    { enabled: bookingIds.length > 0 },
  );
  const lacquersQuery = useApiQuery(
    ["journal", "week-lacquers", subjectId, start, bookingIds.join(",")],
    () => listBookingLacquers(bookingIds),
    { enabled: bookingIds.length > 0 },
  );
  const servicesById = new Map(services.map((s) => [s.id, s]));
  const categoriesQuery = useApiQuery(
    ["journal", "booking-categories"],
    getBookingCategories,
  );
  // F-01-111: перенос перетаскиванием на другой день — сенсор до раннего return ниже (правила хуков).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  // F-16-127: то же наведение-подсветка пакета, что в DayGrid — до раннего return (правила хуков).
  const [hoveredPackageGroupId, setHoveredPackageGroupId] = useState<Id | undefined>(undefined);

  if (hoursQuery.isError || bookingsQuery.isError) {
    return (
      <ErrorState
        onRetry={() => {
          hoursQuery.refetch();
          bookingsQuery.refetch();
        }}
      />
    );
  }
  if (hoursQuery.isLoading || bookingsQuery.isLoading || !hoursQuery.data) {
    return <Skeleton variant="rect" className="h-96 w-full rounded-xl" />;
  }

  const hoursByDay = hoursQuery.data;
  // Ресурс не банднуется на «рабочее/нерабочее» — весь диапазон дня остаётся белым (как DayGrid).
  const range = isStaff ? computeDayRange(Object.values(hoursByDay)) : { startMin: 8 * 60, endMin: 22 * 60 };
  const ticks = hourTicks(range);
  const heightPx = rangeHeightPx(range, zoomMin);
  const bookingsByDay = bookingsQuery.data ?? [];

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over, delta } = event;
    // Тот же класс бага, что у ручки растягивания (F-01-031): гасим синтетический click после
    // отпускания указателя, иначе он открыл бы блок или создал новую запись под курсором.
    const swallowClick = (ev: globalThis.MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener("click", swallowClick, true);
    window.setTimeout(
      () => window.removeEventListener("click", swallowClick, true),
      0,
    );

    if (!over) return;
    const bookingId = String(active.id);
    const booking = bookingsByDay.find((b) => b.id === bookingId);
    const targetDay = String(over.id);
    if (!booking) return;

    const startMinutes =
      Number(booking.start.slice(11, 13)) * 60 +
      Number(booking.start.slice(14, 16));
    const rawMinutes = startMinutes + delta.y / pxPerMin(zoomMin);
    const stepped = Math.round(rawMinutes / zoomMin) * zoomMin;
    const clamped = Math.min(
      Math.max(stepped, range.startMin),
      range.endMin -
        Math.min(booking.durationMin, range.endMin - range.startMin),
    );
    const newStart = `${targetDay}T${fromMinutes(clamped)}`;
    if (newStart === booking.start) return;

    const overlap = isStaff
      ? await hasOverlap(subject.staff.id, newStart, booking.durationMin, booking.id)
      : await hasResourceOverlap(subject.resource.id, subject.instanceId, newStart, booking.durationMin, booking.id);
    if (overlap) {
      toast.error(t("block.resizeOverlap"));
      return;
    }
    const prevStart = booking.start;
    try {
      await updateBooking(booking.id, { start: newStart });
      toast.success(t("grid.moveToast"), {
        action: {
          label: t("window.deleteUndo"),
          onClick: () => {
            updateBooking(booking.id, { start: prevStart }).catch(() =>
              toast.error(tc("states.actionFailed")),
            );
          },
        },
        durationMs: 5000,
      });
    } catch {
      toast.error(tc("states.actionFailed"));
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        data-f="F-01-013 F-01-023 F-02-037 F-16-020"
        className={cn("scrollbar-thin min-h-0 flex-1 overflow-auto overscroll-contain bg-surface", style === "booktime" ? "rounded-2xl border border-border" : "border-t border-border")}
      >
        <div className="flex" style={{ minWidth: days.length * (google ? 104 : 160) + 56 }}>
          <div className="sticky left-0 z-40 flex w-14 shrink-0 flex-col bg-surface">
            <div
              className={cn(
                "sticky top-0 z-40 flex shrink-0 items-end justify-end border-b border-border bg-surface pr-2 pb-1",
                google ? "h-[5.5rem]" : "h-14",
              )}
            >
              {/* «Google Calendar»: часовой пояс в углу, как у Google (журнал — по Еревану) */}
              {google && <span className="text-[10px] text-muted">GMT+04</span>}
            </div>
            <div className="relative" style={{ height: heightPx }}>
              {ticks.slice(1).map((m) => (
                <span
                  key={m}
                  style={{ top: minutesToTop(m, range, zoomMin) }}
                  className={cn(
                    "absolute -translate-y-1/2 text-muted tabular-nums select-none",
                    google ? "right-3 text-[10px] font-medium tracking-wide" : "right-2 text-[11px]",
                  )}
                >
                  <TimeText value={format.time(`${start}T${String(Math.floor(m / 60)).padStart(2, "0")}:00`)} suffixClassName="text-[10px]" hourOnly />
                </span>
              ))}
            </div>
          </div>

          {days.map((day) => {
            const hours = hoursByDay[day] ?? [];
            const bands = isStaff ? hoursToBands(hours, range) : [];
            const bookings = (bookingsQuery.data ?? []).filter((b) =>
              b.start.startsWith(day),
            );
            const working = isStaff ? hours.length > 0 : true;

            return (
              <div
                key={day}
                className={cn("flex flex-1 flex-col border-l border-line", google ? "w-26 min-w-26" : "w-40 min-w-40")}
              >
                {/* «Google Calendar»: «ЧТ» мелко и число в круге, сегодня — круг цвета primary; «Календарь iOS»: «пн 5» в строку,
                    сегодня — красный круг; «BookTime» — «чт, 8 октября» */}
                <div
                  className={cn(
                    "sticky top-0 z-30 flex shrink-0 flex-col items-center justify-center border-b border-border bg-surface text-center",
                    google
                      ? cn("h-[5.5rem] gap-0.5", day === today() ? "text-primary-text" : day === date ? "text-fg" : "text-muted")
                      : ios
                        ? "h-14"
                        : cn("h-14", day === date && "text-primary-text"),
                  )}
                >
                  {ios ? (
                    <span aria-label={format.date(day, "weekday")} className="flex items-center gap-1.5 text-sm">
                      <span className={cn(day === today() ? "font-semibold text-danger" : "text-muted")}>
                        {format.date(day, "weekdayShort").split(",")[0].toLocaleLowerCase()}
                      </span>
                      <span
                        className={cn(
                          "grid size-7 place-items-center rounded-full font-semibold tabular-nums",
                          day === today() ? "bg-danger text-primary-contrast" : day === date ? "bg-fg text-surface" : "text-fg",
                        )}
                      >
                        {Number(day.slice(8, 10))}
                      </span>
                    </span>
                  ) : google ? (
                    <>
                      <span className="text-[11px] font-semibold tracking-wider uppercase">
                        {format.date(day, "weekdayShort").split(",")[0]}
                      </span>
                      <span
                        aria-label={format.date(day, "weekday")}
                        className={cn(
                          "grid size-11 place-items-center rounded-full text-2xl font-normal tabular-nums",
                          day === today() ? "bg-primary text-primary-contrast" : "text-fg",
                        )}
                      >
                        {Number(day.slice(8, 10))}
                      </span>
                    </>
                  ) : (
                    <span className="max-w-full truncate px-1 text-sm font-semibold">
                      {format.date(day, "weekday")}
                    </span>
                  )}
                  {working ? (
                    isStaff && !ios ? (
                      <span className="text-[0.6875rem] text-muted">{`${hours[0].from}–${hours[hours.length - 1].to}`}</span>
                    ) : null
                  ) : (
                    <span className="text-[0.6875rem] text-muted">
                      {t("week.dayOff")}
                    </span>
                  )}
                </div>
                <DroppableCell
                  dayId={day}
                  height={heightPx}
                  onClick={(e) => {
                    if (!canCreate || !working) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    onCreate(
                      day,
                      yToTime(e.clientY - rect.top, range, zoomMin),
                    );
                  }}
                  className={cn(
                    "relative",
                    working && canCreate && "cursor-pointer",
                    !working && "bg-surface-2",
                  )}
                >
                  {working &&
                    bands.map((b, i) => (
                      <div
                        key={i}
                        style={{
                          top: minutesToTop(b.from, range, zoomMin),
                          height: (b.to - b.from) * pxPerMin(zoomMin),
                        }}
                        className={cn(
                          "pointer-events-none absolute inset-x-0",
                          b.working ? "bg-surface" : "bg-surface-2",
                        )}
                      />
                    ))}
                  {ticks.map((m) => (
                    <div
                      key={m}
                      style={{ top: minutesToTop(m, range, zoomMin) }}
                      className="pointer-events-none absolute inset-x-0 border-t border-line"
                    />
                  ))}
                  <NowLine date={day} range={range} zoomMin={zoomMin} />
                  {bookings.map((booking) => {
                    const tone = bookingTone(booking, lacquersQuery.data?.[booking.id], servicesById);
                    const top = minutesToTop(
                      Number(booking.start.slice(11, 13)) * 60 +
                        Number(booking.start.slice(14, 16)),
                      range,
                      zoomMin,
                    );
                    const naturalHeight = booking.durationMin * pxPerMin(zoomMin);
                    const client = booking.clientId
                      ? clientsById[booking.clientId]
                      : undefined;
                    const packageGroupId = extrasQuery.data?.[booking.id]?.packageGroupId;
                    return (
                      <BookingBlock
                        key={booking.id}
                        booking={booking}
                        client={client}
                        services={services}
                        extras={extrasQuery.data?.[booking.id]}
                        tone={tone}
                        text={cardText(
                          booking,
                          client,
                          extrasQuery.data?.[booking.id],
                          { t, format, statusLabel, locale, firstLineMode, showPhones, servicesById, bookingCategories: categoriesQuery.data ?? [] },
                          { isNew: isNewClientBooking(client, booking), lacquerName: tone.lacquerName },
                        )}
                        labels={labels}
                        top={top}
                        height={Math.max(naturalHeight, cardSizes().min)}
                        naturalHeight={naturalHeight}
                        canMove={canCreate}
                        onOpen={openById}
                        packageGroupId={packageGroupId}
                        onPackageHover={setHoveredPackageGroupId}
                        highlighted={Boolean(packageGroupId) && packageGroupId === hoveredPackageGroupId}
                        phase={phaseOf(day, booking)?.phase}
                        progressPct={phaseOf(day, booking)?.pct}
                      />
                    );
                  })}
                </DroppableCell>
              </div>
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}

/** F-01-111: колонка-день — приёмник переноса; `useDroppable` не вызвать напрямую в `.map()`. */
function DroppableCell({
  dayId,
  height,
  onClick,
  className,
  children,
}: {
  dayId: ISODate;
  height: number;
  onClick: (e: ReactMouseEvent<HTMLDivElement>) => void;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayId });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={cn(className, isOver && "bg-primary-soft/30")}
      style={{ height }}
    >
      {children}
    </div>
  );
}
