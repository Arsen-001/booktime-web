"use client";

/**
 * Сетка дня журнала (DESIGN.md → Journal A2): белая карточка r16, шапки мастеров (аватар, имя, полоса загрузки цвета
 * мастера, «N записей»), только рабочие часы, тонкие линии, линия «сейчас» с пилюлей времени, карточки «C · Тон».
 * F-01-018, F-01-019, F-01-020, F-01-021, F-01-022, F-01-023, F-01-024, F-01-031, F-01-034, F-01-215.
 *
 * Скорость (DESIGN.md → Performance): раскладка колонок (позиции, тон, перерывы) считается одним useMemo на данные
 * дня; карточки — чистый CSS без Motion; линия «сейчас» и карточки двигаются transform'ом.
 */
import { TimeText } from '@/areas/journal/components/TimeText';
import { useLocale } from "next-intl";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  useDndMonitor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import type {
  Booking,
  Client,
  DayHours,
  GroupEvent,
  Id,
  ISODate,
  Resource,
  Service,
  Staff,
} from "@/domain/core";
import type {
  BookingCategoryDef,
  BookingExtras,
  BookingLacquer,
  FirstLineMode,
  JournalZoomMin,
  StaffMarkupMin,
} from "@/domain/journal";
import type { EventSeriesDef } from "@/domain/resources";
import { updateBooking } from "@/api/core";
import {
  hasOverlap,
  setBookingBreakOverride,
  setStaffMarkup,
} from "@/api/journal";
import { deleteCells, findAffectedBookings } from "@/api/schedule";
import { useApiMutation } from "@/api/request";
import { useCan, useCurrent } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { cn } from "@/lib/cn";
import { fromMinutes } from "@/lib/date";
import { pickText } from "@/lib/text";
import { BookingBlock } from "@/areas/journal/components/BookingBlock";
import { HoldWhileClosing } from "@/areas/journal/components/HoldWhileClosing";
import { EmptyDayState } from "@/areas/journal/components/EmptyDayState";
import { GroupEventBlock } from "@/areas/journal/components/GroupEventBlock";
import { NowLine } from "@/areas/journal/components/NowLine";
import { lateMinutes, useNowMinuteYerevan } from "@/areas/journal/lib/lateness";
import { StaffScheduleModal } from "@/areas/journal/components/StaffScheduleModal";
import { WorkingDaysRangeModal } from "@/areas/journal/components/WorkingDaysRangeModal";
import {
  bookingTone,
  CARD_MIN_HEIGHT,
  startMinutes,
  staffLoad,
} from "@/areas/journal/lib/board";
import {
  combineBreakMin,
  computeDayRange,
  hourTicks,
  hoursToBands,
  minutesToTop,
  pxPerMin,
  rangeHeightPx,
  yToTime,
} from "@/areas/journal/lib/grid";
import { isNewClientBooking } from "@/areas/journal/lib/heuristics";
import { cardLabels, cardText } from "@/areas/journal/lib/cardText";
import { useBookingStatusLabel } from "@/ui/BookingStatusBadge";
import { useJournalHourFormat } from "@/areas/journal/lib/useJournalHourFormat";
import { Avatar } from "@/ui/Avatar";
import { DropdownChevron } from "@/ui/DropdownChevron";
import { DropdownMenu, type DropdownMenuItem } from "@/ui/DropdownMenu";
import { SharedBookingSlot } from "@/areas/journal/components/SharedBookingSlot";
import { DropGhostBox, type DropGhost } from "@/areas/journal/components/DayViewParts";
import { flattenDay, swallowNextClick, useMoveBooking, type MovePlan } from "@/areas/journal/lib/moveBooking";
import { useConfirm, useToast } from "@/ui/Toast";

export type ColumnDef =
  | {
      kind: "staff";
      id: Id;
      staff: Staff;
      hours: DayHours;
      /** Г3: мастер в этот день не работает (отпуск, выходной, уволен), а записи остались — колонка с пометкой «перенести» */
      off?: { label: string };
      /** Г16: заметка к дню из графика — строкой над колонкой */
      note?: string;
    }
  | {
      kind: "resource";
      id: Id;
      resource: Resource;
      instanceId: Id;
      instanceName: string;
    };

export interface DayGridProps {
  date: ISODate;
  columns: ColumnDef[];
  bookingsByColumn: Record<Id, Booking[]>;
  clientsById: Record<Id, Client>;
  services: Service[];
  /** F-01-028/051/052: ручной цвет и категории записи — одним запросом на весь день */
  extrasById?: Record<Id, BookingExtras>;
  bookingCategories?: BookingCategoryDef[];
  /** Оттенки лака записей дня (F-00-094) — тон карточки «C · Тон» */
  lacquersById?: Record<Id, BookingLacquer>;
  /** F-01-171 и F-01-178 — читаются один раз на сетку, а не в каждой карточке */
  firstLineMode: FirstLineMode;
  showPhones: boolean;
  zoomMin: JournalZoomMin;
  staffMarkupMin: Record<Id, StaffMarkupMin | 0>;
  /** Правка технического перерыва (F-01-032), id записи → минуты; 0 = удалён */
  breakOverrideMin: Record<Id, number>;
  /** F-01-133: 'longest' (по умолчанию) или 'sum' — как считать перерыв визита из нескольких услуг */
  breakCombineMode: "longest" | "sum";
  canCreate: boolean;
  /** Право «Перенос записи» — растягивание длительности (F-01-031) */
  canResize: boolean;
  onCreate: (columnId: Id, startTime: string) => void;
  onOpen: (bookingId: Id) => void;
  groupEventsByColumn?: Record<Id, GroupEvent[]>;
  participantCountByEvent?: Record<Id, number>;
  seriesDefsById?: Record<Id, EventSeriesDef>;
  onOpenGroupEvent?: (eventId: Id) => void;
  hasServices?: boolean;
  hasStaff?: boolean;
  /** F-16-022: у мастера — занятые ресурсы, у ресурса — мастер (настройка showOccupiedResourcesForStaff) */
  showCrossColumnInfo?: boolean;
  allStaff?: Staff[];
  allResources?: Resource[];
  /** F-16-024: телефон — сколько колонок на экран, остальные — прокруткой вбок. Не передан — десктоп (≥ 200px). */
  columnsPerScreen?: number;
  /**
   * «Найти окно» (FindSlotButton): свободные места под выбранную услугу — id колонки → промежутки в минутах, куда
   * услуга помещается. Нажатие ставит начало по месту клика (шаг 15 мин, так, чтобы услуга влезла) → onPickSlot.
   */
  slotGaps?: Record<Id, { from: number; to: number }[]>;
  slotDurationMin?: number;
  onPickSlot?: (columnId: Id, time: string) => void;
  className?: string;
}

const MARKUP_OPTIONS: (StaffMarkupMin | 0)[] = [0, 15, 30, 60, 90, 120];
const GUTTER = 52;

/** Полоса загрузки — цвет мастера (Staff.colorIndex → chart-N) */
const STAFF_BAR: Record<number, string> = {
  1: "bg-chart-1",
  2: "bg-chart-2",
  3: "bg-chart-3",
  4: "bg-chart-4",
  5: "bg-chart-5",
  6: "bg-chart-6",
  7: "bg-chart-7",
  8: "bg-chart-8",
};

export function DayGrid({
  date,
  columns,
  bookingsByColumn,
  clientsById,
  services,
  extrasById = {},
  bookingCategories = [],
  lacquersById = {},
  firstLineMode,
  showPhones,
  zoomMin,
  staffMarkupMin,
  breakOverrideMin,
  breakCombineMode,
  canCreate,
  canResize,
  onCreate,
  onOpen,
  groupEventsByColumn = {},
  seriesDefsById = {},
  participantCountByEvent = {},
  onOpenGroupEvent,
  hasServices = true,
  hasStaff = true,
  showCrossColumnInfo = false,
  allStaff = [],
  allResources = [],
  columnsPerScreen,
  slotGaps,
  slotDurationMin = 0,
  onPickSlot,
  className,
}: DayGridProps) {
  const columnWidth = columnsPerScreen ? `calc((100cqw - ${GUTTER}px) / ${columnsPerScreen})` : undefined;
  const t = useT("journal");
  const tc = useT("common");
  const toast = useToast();
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const locale = useLocale();
  const statusLabel = useBookingStatusLabel();
  const setMarkup = useApiMutation(({ staffId, min }: { staffId: Id; min: StaffMarkupMin | 0 }) => setStaffMarkup(staffId, min));
  // F-01-110/F-01-114: сенсор перетаскивания — до раннего return ниже (правила хуков)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const canEditSchedule = useCan("journal.edit");
  const { staffId: ownStaffId, ready: currentReady } = useCurrent();
  const confirm = useConfirm();
  const mover = useMoveBooking({ date, clientsById, resources: allResources });
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [editHoursStaffId, setEditHoursStaffId] = useState<Id | undefined>(undefined);
  const [rangeModal, setRangeModal] = useState<{ mode: "add" | "remove"; staffId: Id } | undefined>(undefined);
  // F-16-127: наведение на любую запись пакета подсвечивает все связанные записи (общий packageGroupId)
  const [hoveredPackageGroupId, setHoveredPackageGroupId] = useState<Id | undefined>(undefined);
  const lateNow = useNowMinuteYerevan(date);

  // Раскладка дня — один расчёт на данные (не на кадр прокрутки и не на наведение): диапазон часов, полосы
  // рабочего времени, позиции и тон каждой карточки, перерывы, подписи F-16-022.
  const layout = useMemo(() => {
    const staffNameById = new Map(allStaff.map((s) => [s.id, s.name]));
    const instanceLabelById = new Map<Id, string>();
    for (const r of allResources) {
      const resourceName = pickText(r.name, locale);
      for (const inst of r.instances) instanceLabelById.set(inst.id, r.instances.length > 1 ? `${resourceName} ${inst.name}`.trim() : resourceName);
    }
    const servicesById = new Map(services.map((s) => [s.id, s]));
    const textCtx = { t, format, statusLabel, locale, firstLineMode, showPhones, servicesById, bookingCategories };
    const allBookings = Object.values(bookingsByColumn).flat();
    const range = computeDayRange(
      columns.filter((c) => c.kind === "staff").map((c) => (c.kind === "staff" ? c.hours : [])),
      allBookings.map((b) => ({ from: startMinutes(b), to: startMinutes(b) + b.durationMin })),
    );
    const ppm = pxPerMin(zoomMin);
    const cols = columns.map((column) => {
      const bookings = bookingsByColumn[column.id] ?? [];
      const bands = column.kind === "staff" ? hoursToBands(column.hours, range) : [];
      const markup = column.kind === "staff" ? (staffMarkupMin[column.staff.id] ?? 0) : 0;
      const markupLines: number[] = [];
      if (markup > 0) for (let m = range.startMin; m <= range.endMin; m += markup) markupLines.push(m);
      const load = column.kind === "staff" ? staffLoad(column.hours, bookings) : { count: bookings.length, ratio: 0 };
      const items = bookings.map((booking) => {
        const bufferMax = combineBreakMin(
          booking.services.map((s) => servicesById.get(s.serviceId)?.bufferAfterMin ?? 0),
          breakCombineMode,
        );
        const client = booking.clientId ? clientsById[booking.clientId] : undefined;
        const crossColumnLabel = !showCrossColumnInfo
          ? undefined
          : column.kind === "staff"
            ? booking.resourceIds.map((id) => instanceLabelById.get(id)).filter(Boolean).join(", ") || undefined
            : staffNameById.get(booking.staffId);
        const tone = bookingTone(booking, lacquersById[booking.id], servicesById);
        const naturalHeight = booking.durationMin * ppm;
        return {
          booking,
          client,
          top: minutesToTop(startMinutes(booking), range, zoomMin),
          height: Math.max(naturalHeight, CARD_MIN_HEIGHT),
          naturalHeight,
          tone,
          text: cardText(booking, client, extrasById[booking.id], textCtx, {
            cross: crossColumnLabel,
            isNew: isNewClientBooking(client, booking),
            lacquerName: tone.lacquerName,
          }),
          bufferMax,
          breakMin: breakOverrideMin[booking.id] ?? bufferMax,
        };
      });
      return { column, bands, markup, markupLines, load, items };
    });
    return { range, cols, ticks: hourTicks(range), heightPx: rangeHeightPx(range, zoomMin), ppm };
  }, [columns, bookingsByColumn, clientsById, services, lacquersById, extrasById, bookingCategories, zoomMin, staffMarkupMin, breakOverrideMin, breakCombineMode, showCrossColumnInfo, allStaff, allResources, locale, t, format, statusLabel, firstLineMode, showPhones]);
  const labels = useMemo(() => cardLabels(t, format), [t, format]);

  const { range, ticks, heightPx, ppm } = layout;

  // Колбэки карточек стабильны на всю жизнь сетки (через ref на свежие обработчики): memo карточек не сбивается
  // от того, что экран журнала перерисовался (открылось окно, пришли данные соседнего дня).
  const latest = useRef({ onOpen, resize: (_b: Booking, _m: number) => {}, breakChange: (_id: Id, _m: number) => {} });
  const cardHandlers = useMemo(
    () => ({
      open: (id: Id) => latest.current.onOpen(id),
      resize: (b: Booking, m: number) => latest.current.resize(b, m),
      breakChange: (id: Id, m: number) => latest.current.breakChange(id, m),
      packageHover: (groupId: Id | undefined) => setHoveredPackageGroupId(groupId),
    }),
    [],
  );

  // F-01-020/F-01-126: рабочий день с записями удалить НЕЛЬЗЯ — диалог объясняет, день остаётся рабочим
  const handleCancelDay = async (staffId: Id) => {
    const ownStaffName = columns.find((c) => c.kind === "staff" && c.staff.id === ownStaffId);
    const actorName = (currentReady && ownStaffName?.kind === "staff" && ownStaffName.staff.name) || t("window.deleteAuthorFallback");
    try {
      await deleteCells({ staffIds: [staffId], dates: [date], actorName });
      toast.success(tc("states.saved"));
    } catch {
      const affected = await findAffectedBookings([staffId], [date]);
      await confirm({
        title: t("grid.staffMenu.cancelDayTitle"),
        description: t("grid.staffMenu.cancelDayWarning", { count: affected.length }),
        tone: "danger",
        confirmLabel: t("grid.staffMenu.cancelDayConfirm"),
      });
    }
  };


  const handleColumnClick = (column: ColumnDef, event: MouseEvent<HTMLDivElement>) => {
    if (!canCreate) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onCreate(column.id, yToTime(event.clientY - rect.top, range, zoomMin));
  };

  // F-01-031: растягивание конца записи; пересечение с другой записью мастера блокируется (F-00-045)
  const handleResize = async (booking: Booking, newDurationMin: number) => {
    const overlap = await hasOverlap(booking.staffId, booking.start, newDurationMin, booking.id);
    if (overlap) {
      toast.error(t("block.resizeOverlap"));
      return;
    }
    try {
      await updateBooking(booking.id, { durationMin: newDurationMin });
    } catch {
      toast.error(tc("states.actionFailed"));
    }
  };

  const handleBreakChange = async (bookingId: Id, minutes: number) => {
    try {
      await setBookingBreakOverride(bookingId, minutes);
    } catch {
      toast.error(tc("states.actionFailed"));
    }
  };

  useLayoutEffect(() => {
    latest.current = { onOpen, resize: handleResize, breakChange: handleBreakChange };
  });

  // Пустой день — после всех хуков и обработчиков
  const anyWorking = columns.some((c) => (c.kind === "staff" ? c.hours.length > 0 : true));
  if (columns.length === 0 || !anyWorking)
    return (
      <div className={className}>
        <EmptyDayState hasServices={hasServices} hasStaff={hasStaff} />
      </div>
    );

  // F-01-110/F-01-114: куда ляжет карточка — колонка под ней и время с шагом сетки. Одна функция на подсказку
  // при перетаскивании (DragHint) и на само отпускание, чтобы призрак и результат не расходились
  const planDrop = (activeId: string, overId: string | undefined, deltaY: number) => {
    if (!overId) return null;
    const sourceColumn = columns.find((c) => (bookingsByColumn[c.id] ?? []).some((b) => b.id === activeId));
    const booking = sourceColumn ? (bookingsByColumn[sourceColumn.id] ?? []).find((b) => b.id === activeId) : undefined;
    const targetColumn = columns.find((c) => c.id === overId);
    if (!booking || !sourceColumn || !targetColumn) return null;
    const rawMinutes = startMinutes(booking) + deltaY / ppm;
    const stepped = Math.round(rawMinutes / zoomMin) * zoomMin;
    const startMin = Math.min(Math.max(stepped, range.startMin), range.endMin - Math.min(booking.durationMin, range.endMin - range.startMin));
    const plan: MovePlan =
      targetColumn.kind === "staff"
        ? { staffId: targetColumn.staff.id, resourceIds: booking.resourceIds, startMin }
        : {
            staffId: booking.staffId,
            resourceIds: [targetColumn.instanceId],
            startMin,
            targetInstance: { resourceId: targetColumn.resource.id, instanceId: targetColumn.instanceId },
          };
    const unchanged = startMin === startMinutes(booking) && targetColumn.id === sourceColumn.id;
    return { booking, targetColumn, plan, unchanged };
  };

  // F-01-110/F-01-114: перенос карточки на другую колонку и/или время; «Отменить» на 5 секунд (F-00-061) — lib/moveBooking
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over, delta } = event;
    swallowNextClick();
    const drop = planDrop(String(active.id), over ? String(over.id) : undefined, delta.y);
    if (!drop || drop.unchanged) return;
    await mover.move(drop.booking, drop.plan);
  };

  const colStyle = columnWidth ? { width: columnWidth, minWidth: columnWidth } : undefined;
  const colClass = columnsPerScreen ? "shrink-0 snap-start" : "min-w-[200px] flex-1";
  const minWidth = columnsPerScreen ? `calc(${columns.length} * ${columnWidth} + ${GUTTER}px)` : columns.length * 200 + GUTTER;

  const staffMenuItems = (staff: Staff, markup: StaffMarkupMin | 0): DropdownMenuItem[] => [
    ...(canEditSchedule
      ? ([
          { id: "hours", label: t("grid.staffMenu.editHours"), onSelect: () => setEditHoursStaffId(staff.id) },
          { id: "cancel", label: t("grid.staffMenu.cancelDay"), onSelect: () => handleCancelDay(staff.id) },
          { id: "sep", separator: true as const },
          { id: "addDays", label: t("grid.staffMenu.addDays"), onSelect: () => setRangeModal({ mode: "add", staffId: staff.id }) },
          {
            id: "removeDays",
            label: t("grid.staffMenu.removeDays"),
            danger: true,
            onSelect: () => setRangeModal({ mode: "remove", staffId: staff.id }),
          },
          { id: "sep2", separator: true as const },
        ] satisfies DropdownMenuItem[])
      : []),
    // F-01-021: разметка колонки — та же настройка, что раньше жила отдельной строкой под именем
    { id: "markup", groupLabel: markup > 0 ? `${t("grid.markup")}: ${format.duration(markup)}` : t("grid.markup") },
    ...MARKUP_OPTIONS.map((m) => ({
      id: `markup-${m}`,
      label: m === 0 ? t("grid.markupNone") : format.duration(m),
      disabled: m === markup,
      onSelect: () => setMarkup.mutate({ staffId: staff.id, min: m }),
    })),
  ];

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className={cn("relative flex min-h-0 flex-col", className)}>
        <div
          data-f="F-01-018 F-01-019 F-01-022 F-01-023 F-01-024 F-01-034 F-01-215"
          // F-01-184: на телефоне «+ Запись» висит над правым нижним углом — запас снизу даёт докрутить последнюю
          // карточку выше неё
          className={cn(
            "scrollbar-thin min-h-0 flex-1 overflow-auto overscroll-contain rounded-2xl border border-border bg-surface pb-24 md:pb-0",
            // snap с отступом на колонку часов: иначе первая колонка «прилипает» под неё и видна обрезанной
            columnsPerScreen && "@container snap-x scroll-pl-[52px]",
          )}
        >
          <div style={{ minWidth }}>
            {/* Шапки колонок — прилипают сверху */}
            <div className="sticky top-0 z-30 flex border-b border-border bg-surface">
              <div className="sticky left-0 z-10 shrink-0 bg-surface" style={{ width: GUTTER }} />
              {layout.cols.map(({ column, load, markup }) => (
                <div
                  key={column.id}
                  className={cn("flex h-16 items-center gap-2.5 border-l border-line px-3", colClass)}
                  style={colStyle}
                >
                  {column.kind === "staff" ? (
                    <>
                      <Avatar
                        name={column.staff.name}
                        src={column.staff.avatarUrl}
                        colorIndex={column.staff.colorIndex}
                        size={columnsPerScreen ? "xs" : "sm"}
                        className="shrink-0"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        {/* F-01-020/F-01-126: меню графика по имени — у кого есть право править график; разметка (F-01-021) — у всех */}
                        {canEditSchedule ? (
                          <span data-f="F-01-020 F-01-126 F-02-025" className="min-w-0">
                          <DropdownMenu
                            align="start"
                            label={column.staff.name}
                            trigger={(p) => (
                              <button
                                {...p}
                                type="button"
                                className="-mx-1 flex min-h-10 max-w-full items-center gap-1 rounded-md px-1 text-sm font-semibold text-fg hover:bg-surface-2"
                              >
                                {/* Телефон (A2-phone): в узкой колонке — только имя */}
                                <span className="truncate">{columnsPerScreen ? column.staff.name.split(" ")[0] : column.staff.name}</span>
                                <DropdownChevron open={p["aria-expanded"]} className="size-3.5" />
                              </button>
                            )}
                            items={staffMenuItems(column.staff, markup)}
                          />
                          </span>
                        ) : (
                          <span className="min-w-0">
                          <DropdownMenu
                            align="start"
                            label={column.staff.name}
                            trigger={(p) => (
                              <button
                                {...p}
                                type="button"
                                className="-mx-1 flex min-h-10 max-w-full items-center gap-1 rounded-md px-1 text-sm font-semibold text-fg hover:bg-surface-2"
                              >
                                {/* Телефон (A2-phone): в узкой колонке — только имя */}
                                <span className="truncate">{columnsPerScreen ? column.staff.name.split(" ")[0] : column.staff.name}</span>
                                <DropdownChevron open={p["aria-expanded"]} className="size-3.5" />
                              </button>
                            )}
                            items={staffMenuItems(column.staff, markup)}
                          />
                          </span>
                        )}
                        <span className="flex items-center gap-2" aria-label={t("board.column.load", { pct: Math.round(load.ratio * 100) })}>
                          <span aria-hidden className={cn("relative hidden h-1 w-16 overflow-hidden rounded-full bg-surface-3", !column.off && "lg:block")}>
                            <span
                              className={cn("absolute inset-y-0 left-0 rounded-full", STAFF_BAR[column.staff.colorIndex] ?? "bg-primary")}
                              style={{ width: `${Math.round(load.ratio * 100)}%` }}
                            />
                          </span>
                          {column.off ? (
                            <span data-f="F-02-029" className="truncate text-xs font-medium text-warning" title={t("board.column.offBookings", { label: column.off.label, n: load.count })}>
                              {t("board.column.offBookings", { label: column.off.label, n: load.count })}
                            </span>
                          ) : (
                            <span className="truncate text-xs text-muted" title={column.note}>
                              {t("board.column.bookings", { n: load.count })}
                              {column.note && <span className="text-info"> · {column.note}</span>}
                            </span>
                          )}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span data-f="F-16-019 F-16-023" className="truncate text-sm font-semibold">
                        {pickText(column.resource.name, locale)} · {column.instanceName}
                      </span>
                      <span className="text-xs text-muted">{t("board.column.bookings", { n: load.count })}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Тело: колонка часов (прилипает слева) + колонки мастеров/ресурсов */}
            <div ref={bodyRef} className="relative flex">
              <div className="sticky left-0 z-20 shrink-0 bg-surface" style={{ width: GUTTER, height: heightPx }}>
                {ticks.slice(1).map((m) => (
                  <span
                    key={m}
                    style={{ top: minutesToTop(m, range, zoomMin) }}
                    className="absolute right-2 -translate-y-1/2 text-[11px] text-muted tabular-nums select-none"
                  >
                    <TimeText value={format.time(`${date}T${String(Math.floor(m / 60)).padStart(2, "0")}:00`)} suffixClassName="text-[10px]" hourOnly />
                  </span>
                ))}
                <NowLine date={date} range={range} zoomMin={zoomMin} variant="pill" />
              </div>

              {layout.cols.map(({ column, bands, markupLines, items }) => (
                <div key={column.id} className={cn("border-l border-line", colClass)} style={colStyle}>
                  <DroppableCell
                    data-f={column.kind === "resource" ? "F-16-023" : undefined}
                    columnId={column.id}
                    height={heightPx}
                    canCreate={canCreate}
                    onClick={(e) => handleColumnClick(column, e)}
                  >
                    {/* DESIGN.md → Journal 3: сетка уже обрезана по общему рабочему диапазону (computeDayRange) —
                        эта заливка красит только чужой перерыв ВНУТРИ него (обед, окно между сменами одного
                        мастера), поэтому тон совсем лёгкий — не «длинный серый блок», а спокойный фон. */}
                    {bands
                      .filter((b) => !b.working)
                      .map((b) => (
                        <div
                          key={`${b.from}-${b.to}`}
                          style={{ top: minutesToTop(b.from, range, zoomMin), height: (b.to - b.from) * ppm }}
                          className="pointer-events-none absolute inset-x-0 bg-surface-2/50"
                        />
                      ))}
                    {ticks.slice(1).map((m) => (
                      <div
                        key={m}
                        style={{ top: minutesToTop(m, range, zoomMin) }}
                        className="pointer-events-none absolute inset-x-0 border-t border-line"
                      />
                    ))}
                    {(slotGaps?.[column.id] ?? []).map((g) => {
                      const from = format.time(`${date}T${fromMinutes(g.from)}`);
                      const to = format.time(`${date}T${fromMinutes(g.to)}`);
                      return (
                        <button
                          key={`slot-${g.from}`}
                          type="button"
                          aria-label={t("board.findSlot.gap", { from, to })}
                          style={{ top: minutesToTop(g.from, range, zoomMin), height: (g.to - g.from) * ppm }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                            const at = g.from + Math.floor(y / ppm / 15) * 15;
                            onPickSlot?.(column.id, fromMinutes(Math.max(g.from, Math.min(at, g.to - slotDurationMin))));
                          }}
                          className="absolute inset-x-1 z-[1] flex animate-fade-in items-start overflow-hidden rounded-lg border-2 border-dashed border-primary/50 bg-primary-soft/70 px-2 pt-1 text-left text-xs font-semibold text-primary-text transition-colors hover:border-primary hover:bg-primary-soft"
                        >
                          {t("board.findSlot.gap", { from, to })}
                        </button>
                      );
                    })}
                    {markupLines.map((m) => (
                      <div
                        key={m}
                        data-f="F-01-021"
                        style={{ top: minutesToTop(m, range, zoomMin) }}
                        className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border"
                      />
                    ))}
                    {items.map((item) => {
                      const packageGroupId = extrasById[item.booking.id]?.packageGroupId;
                      const block = (
                        <BookingBlock
                          key={item.booking.id}
                          booking={item.booking}
                          client={item.client}
                          services={services}
                          tone={item.tone}
                          text={item.text}
                          labels={labels}
                          extras={extrasById[item.booking.id]}
                          top={item.top}
                          height={item.height}
                          naturalHeight={item.naturalHeight}
                          breakMin={item.breakMin}
                          defaultBreakMin={item.bufferMax}
                          onBreakChange={cardHandlers.breakChange}
                          pxPerMin={ppm}
                          zoomStepMin={zoomMin}
                          canResize={canResize}
                          onResize={cardHandlers.resize}
                          canMove={canResize}
                          onOpen={cardHandlers.open}
                          packageGroupId={packageGroupId}
                          onPackageHover={cardHandlers.packageHover}
                          highlighted={Boolean(packageGroupId) && packageGroupId === hoveredPackageGroupId}
                          late={lateMinutes(item.booking, lateNow) !== null}
                        />
                      );
                      return (
                        <SharedBookingSlot
                          key={item.booking.id}
                          bookingId={item.booking.id}
                          ghostStyle={{ top: item.top, height: item.height, backgroundColor: item.tone.fill }}
                        >
                          {block}
                        </SharedBookingSlot>
                      );
                    })}
                    {(groupEventsByColumn[column.id] ?? []).map((event) => {
                      const from = minutesToTop(startMinutes(event), range, zoomMin);
                      return (
                        <GroupEventBlock
                          key={event.id}
                          event={event}
                          service={services.find((sv) => sv.id === event.serviceId)}
                          participantCount={participantCountByEvent[event.id] ?? 0}
                          seriesEndDate={event.seriesId ? seriesDefsById[event.seriesId]?.endDate : undefined}
                          modifiedFromSeries={
                            event.seriesId ? Boolean(seriesDefsById[event.seriesId]?.uniqueEventIds.includes(event.id)) : false
                          }
                          top={from}
                          height={Math.max(event.durationMin * ppm, 18)}
                          onOpen={() => onOpenGroupEvent?.(event.id)}
                        />
                      );
                    })}
                  </DroppableCell>
                </div>
              ))}

              {canResize && (
                <DragHint
                  bodyRef={bodyRef}
                  planDrop={planDrop}
                  check={(booking, plan, column) =>
                    mover.check(booking, plan, flattenDay(bookingsByColumn), column.kind === "staff" ? column.hours : undefined)
                  }
                  describe={mover}
                  topOf={(m) => minutesToTop(m, range, zoomMin)}
                  ppm={ppm}
                  maxY={heightPx}
                />
              )}

              {/* Линия «сейчас» — одна через все колонки, поверх карточек */}
              <div className="pointer-events-none absolute inset-y-0 right-0" style={{ left: GUTTER }}>
                <NowLine date={date} range={range} zoomMin={zoomMin} />
              </div>
            </div>
          </div>
        </div>
        {/* qa demo-q1: на телефоне видно две колонки — тень у правого края подсказывает, что дальше есть ещё */}
        {columnsPerScreen && columns.length > columnsPerScreen && (
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-40 w-6 rounded-r-2xl bg-gradient-to-l from-surface to-transparent" />
        )}
      </div>

      <HoldWhileClosing>
      {editHoursStaffId ? (
        <StaffScheduleModal
          open
          onOpenChange={(o) => !o && setEditHoursStaffId(undefined)}
          date={date}
          staffList={columns.filter((c): c is Extract<ColumnDef, { kind: "staff" }> => c.kind === "staff").map((c) => c.staff)}
          fixedStaffId={editHoursStaffId}
          onSaved={() => setEditHoursStaffId(undefined)}
        />
      ) : null}
      </HoldWhileClosing>

      <HoldWhileClosing>
      {rangeModal ? (
        <WorkingDaysRangeModal
          open
          onOpenChange={(o) => !o && setRangeModal(undefined)}
          mode={rangeModal.mode}
          staffId={rangeModal.staffId}
          staffList={columns.filter((c): c is Extract<ColumnDef, { kind: "staff" }> => c.kind === "staff").map((c) => c.staff)}
          defaultDate={date}
          onSaved={() => setRangeModal(undefined)}
        />
      ) : null}
      </HoldWhileClosing>
    </DndContext>
  );
}

/** F-01-110/F-01-114: колонка-приёмник переноса (useDroppable нельзя звать прямо в .map()) */
function DroppableCell({
  columnId,
  height,
  canCreate,
  onClick,
  children,
  "data-f": extraDataF,
}: {
  columnId: Id;
  height: number;
  canCreate: boolean;
  onClick: (e: MouseEvent<HTMLDivElement>) => void;
  children: ReactNode;
  "data-f"?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  return (
    <div
      ref={setNodeRef}
      data-col={columnId}
      data-f={extraDataF ? `F-01-024 ${extraDataF}` : "F-01-024"}
      onClick={onClick}
      className={cn("relative", canCreate && "cursor-pointer", isOver && "bg-primary-soft/40")}
      style={{ height }}
    >
      {children}
    </div>
  );
}

/**
 * Подсказка места при переносе в «Колонках»: призрак в целевой колонке — зелёный (свободно), жёлтый (вне графика),
 * красный с причиной («Занято: 14:00 Гагик А.», «Занято: Кресло»). Своё состояние и подписка useDndMonitor — сетка
 * не перерисовывается на движение; сам призрак меняется только при смене клетки (колонка × шаг сетки).
 */
function DragHint({
  bodyRef,
  planDrop,
  check,
  describe,
  topOf,
  ppm,
  maxY,
}: {
  bodyRef: React.RefObject<HTMLDivElement | null>;
  planDrop: (activeId: string, overId: string | undefined, deltaY: number) => {
    booking: Booking;
    targetColumn: ColumnDef;
    plan: MovePlan;
    unchanged: boolean;
  } | null;
  check: (booking: Booking, plan: MovePlan, column: ColumnDef) => ReturnType<ReturnType<typeof useMoveBooking>["check"]>;
  describe: Pick<ReturnType<typeof useMoveBooking>, "reason" | "range">;
  topOf: (minutes: number) => number;
  ppm: number;
  /** Высота тела сетки: у самого низа подпись встаёт над местом, а не вылезает за край */
  maxY: number;
}) {
  const [ghost, setGhost] = useState<DropGhost | null>(null);
  const keyRef = useRef("");
  const update = (e: DragMoveEvent) => {
    const drop = planDrop(String(e.active.id), e.over ? String(e.over.id) : undefined, e.delta.y);
    const key = drop && !drop.unchanged ? `${drop.targetColumn.id}:${drop.plan.startMin}` : "";
    if (key === keyRef.current) return;
    keyRef.current = key;
    const body = bodyRef.current;
    const cell = drop && body ? body.querySelector<HTMLElement>(`[data-col="${CSS.escape(drop.targetColumn.id)}"]`) : null;
    if (!drop || drop.unchanged || !body || !cell) return setGhost(null);
    const issue = check(drop.booking, drop.plan, drop.targetColumn);
    const span = describe.range(drop.plan.startMin, drop.booking.durationMin);
    const top = topOf(drop.plan.startMin);
    const height = Math.max(drop.booking.durationMin * ppm, CARD_MIN_HEIGHT);
    setGhost({
      left: cell.getBoundingClientRect().left - body.getBoundingClientRect().left + 4,
      top,
      width: cell.getBoundingClientRect().width - 8,
      height,
      tone: !issue ? "ok" : issue.kind === "hours" ? "warn" : "bad",
      label: !issue ? span : issue.kind === "hours" ? `${span} · ${describe.reason(issue)}` : describe.reason(issue),
      // Подпись под местом: над ним её закрывала бы сама карточка, которая едет за курсором чуть выше/ниже клетки
      labelBelow: top + height + 28 <= maxY,
    });
  };
  const clear = () => {
    keyRef.current = "";
    setGhost(null);
  };
  useDndMonitor({ onDragMove: update, onDragOver: update, onDragEnd: clear, onDragCancel: clear });
  return ghost ? <DropGhostBox ghost={ghost} /> : null;
}
