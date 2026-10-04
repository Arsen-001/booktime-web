"use client";

/**
 * Список «Работают» (С7 обзора «Сотрудники», 27.09.2026): ОДНА таблица во всю ширину с общей шапкой, должность —
 * строкой-разделителем внутри («Мастер маникюра · 3 сотрудника»), колонки одинаковые у всех групп. Вместо
 * повторяющейся «Должности» — «Специализация»; добавлены «График» и «Услуги» (С8).
 *
 * Поиск и фильтры НЕ пересоздают таблицу (М6): все строки смонтированы, лишние получают hidden, пустая группа
 * прячет свой разделитель. Порядок — перетаскиванием за ⠿ внутри группы или стрелками (С1, useRowReorder).
 * Телефон (С6): строка — имя на всю ширину, под ним «телефон · статус», справа то же меню «⋯», что на компьютере.
 */
import { GripVertical, ChevronRight, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Fragment, useState, type KeyboardEvent, type ReactNode } from "react";
import type { StaffListRow } from "@/api/staff";
import {
  ContactsCell,
  ScheduleCell,
  SeatLabel,
  ServicesCell,
} from "@/areas/staff/components/StaffCells";
import { StaffRowActions, type StaffRowActionsProps } from "@/areas/staff/components/StaffRowActions";
import { useRowReorder, type MovePlace } from "@/areas/staff/components/useRowReorder";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { pickText } from "@/lib/text";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { EmptyState } from "@/ui/EmptyState";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/ui/Pagination";
import { Skeleton, SkeletonText } from "@/ui/Skeleton";
import { Switch } from "@/ui/Switch";

export interface StaffGroup {
  key: string;
  label: string;
  ids: string[];
}

export type StaffTeamSort = "order" | "nameAsc" | "nameDesc";

type RowActions = Omit<StaffRowActionsProps, "row" | "canManage">;

export interface StaffTeamTableProps extends RowActions {
  rows: StaffListRow[];
  groups: StaffGroup[];
  visible: ReadonlySet<string>;
  loading: boolean;
  canManage: boolean;
  locale: string;
  sort: StaffTeamSort;
  onSortChange: (sort: StaffTeamSort) => void;
  onOpen: (row: StaffListRow) => void;
  onToggleOnline: (row: StaffListRow, enabled: boolean) => void;
  onMove: (staffId: string, targetId: string, place: MovePlace) => void;
}

/** Анимация появления/исчезновения строки при поиске — только opacity, строка не пересоздаётся */
const ROW_FADE = "transition-[opacity,display] transition-discrete duration-150 starting:opacity-0 [&[hidden]]:opacity-0";

export function StaffTeamTable(props: StaffTeamTableProps) {
  const { rows, groups, visible, loading, canManage, sort, onSortChange, onMove } = props;
  const t = useT("staff");
  const reorderEnabled = canManage && sort === "order";
  const reorder = useRowReorder({ enabled: reorderEnabled, onMove });
  const byId = new Map(rows.map((r) => [r.staff.id, r]));
  const anyVisible = rows.some((r) => visible.has(r.staff.id));

  // Постранично, как во всех списках (owner 29.09.2026): 10 на странице, выбор 10/20/50/100. Страница режется по
  // найденным сотрудникам в порядке групп; строки вне страницы — hidden, как и не найденные (таблица не пересоздаётся)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const ordered = groups.flatMap((g) => g.ids.filter((id) => byId.has(id) && visible.has(id)));
  const [seenCount, setSeenCount] = useState(ordered.length);
  if (seenCount !== ordered.length) {
    setSeenCount(ordered.length);
    setPage(1);
  }
  const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const onPage = new Set(ordered.slice((currentPage - 1) * pageSize, currentPage * pageSize));
  const isShown = (id: string) => onPage.has(id);

  const nameSortIcon =
    sort === "nameAsc" ? <ArrowUp className="size-4" aria-hidden /> : sort === "nameDesc" ? <ArrowDown className="size-4" aria-hidden /> : <ArrowUpDown className="size-4 opacity-60" aria-hidden />;
  const nextSort: StaffTeamSort = sort === "order" ? "nameAsc" : sort === "nameAsc" ? "nameDesc" : "order";

  return (
    <div data-f="F-10-005 F-10-009 F-10-013" className="flex flex-col gap-2">
      <p className="text-[13px] text-muted">{reorderEnabled || !canManage ? t("table.orderHint") : t("table.orderSortedHint")}</p>

      {/* Компьютер: одна таблица */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface shadow-xs scrollbar-thin md:block" aria-busy={loading || undefined}>
        <table aria-label={t("tabs.team")} className="row-links w-full border-collapse text-left text-[0.9375rem]">
          <thead className="bg-surface-2/70 text-[13px] text-muted">
            <tr>
              <th scope="col" className="w-10 px-2" aria-label={t("table.dragHandle")} />
              <th scope="col" aria-sort={sort === "nameAsc" ? "ascending" : sort === "nameDesc" ? "descending" : undefined} className="h-11 px-3 py-2 font-semibold whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onSortChange(nextSort)}
                  className={cn("-mx-2 inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 hover:bg-surface-3 hover:text-fg", sort !== "order" && "text-fg")}
                >
                  {t("table.name")}
                  {nameSortIcon}
                </button>
              </th>
              <th scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">{t("table.specialty")}</th>
              <th scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">{t("table.contacts")}</th>
              <th scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">{t("table.schedule")}</th>
              <th scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">{t("table.services")}</th>
              <th scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">{t("table.onlineBooking")}</th>
              <th scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">{t("table.license")}</th>
              <th scope="col" className="w-12 px-2" aria-label={t("row.menu")} />
            </tr>
          </thead>
          {loading ? (
            // Та же таблица: строки-должности (как в демо — 1, 2 и 3 сотрудника) и строки сотрудников той же разметки
            <tbody data-skeleton>
              {SKELETON_GROUPS.map((n, g) => (
                <Fragment key={g}>
                  <tr className="border-t border-border bg-surface-2/40">
                    <th scope="rowgroup" colSpan={9} className="h-10 px-4 text-left text-[13px] font-semibold text-fg">
                      <SkeletonText width={g ? "12ch" : "14ch"} />
                    </th>
                  </tr>
                  {Array.from({ length: n }, (_, i) => (
                    <tr key={i} className="h-14 border-t border-border bg-surface">
                      <td className="px-2 align-middle">
                        <span aria-hidden className="inline-flex size-9 items-center justify-center text-muted">
                          <GripVertical aria-hidden className="size-4" />
                        </span>
                      </td>
                      <td className="min-w-48 px-3 py-2 align-middle">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Skeleton variant="circle" className="size-8 shrink-0" />
                          <span className="flex min-w-0 flex-col items-start gap-0.5">
                            <span className="truncate font-medium text-fg">
                              <SkeletonText width={i % 2 ? "13ch" : "15ch"} />
                            </span>
                            {g < 2 && (
                              <Badge tone="info" size="sm">
                                <SkeletonText width="10ch" />
                              </Badge>
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="max-w-40 px-3 py-2 align-middle text-sm text-muted">
                        <SkeletonText width="4ch" />
                      </td>
                      <td className="px-3 py-2 align-middle text-sm">
                        <SkeletonText width="11.5ch" />
                      </td>
                      <td className="px-3 py-2 align-middle text-sm whitespace-nowrap">
                        <SkeletonText width="7ch" />
                      </td>
                      <td className="px-3 py-2 align-middle text-sm whitespace-nowrap">
                        <SkeletonText width="6ch" />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <span className="inline-flex min-h-11 items-center">
                          <Switch checked disabled aria-hidden tabIndex={-1} />
                        </span>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <span className="flex flex-col text-sm leading-tight">
                          <span className="font-medium text-fg">
                            <SkeletonText width="9ch" />
                          </span>
                          <span className="text-[13px] text-muted">
                            <SkeletonText width="17ch" />
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right align-middle" />
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          ) : (
            <tbody>
              {groups.map((g) => {
                const shown = g.ids.filter((id) => visible.has(id)).length;
                return (
                  <GroupRows key={g.key} group={g} shown={shown} onPage={g.ids.some(isShown)}>
                    {g.ids.map((id) => {
                      const row = byId.get(id);
                      if (!row) return null;
                      return (
                        <StaffTableRow
                          key={id}
                          {...props}
                          row={row}
                          groupKey={g.key}
                          hidden={!isShown(id)}
                          reorderEnabled={reorderEnabled}
                          onHandlePointerDown={reorder.onPointerDown}
                          onHandleKeyDown={reorder.onKeyDown}
                        />
                      );
                    })}
                  </GroupRows>
                );
              })}
              <tr hidden={anyVisible} className="border-t border-border">
                <td colSpan={9}>
                  <EmptyState variant="section" kind="search" title={t("empty.searchTitle")} compact />
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>

      {/* Телефон: строки-карточки с разделителями должностей */}
      <ul aria-label={t("tabs.team")} aria-busy={loading || undefined} className="row-links flex flex-col gap-2 md:hidden">
        {loading
          ? SKELETON_GROUPS.map((n, g) => (
              <Fragment key={g}>
                <li data-skeleton aria-hidden className="px-1 pt-2 text-[13px] font-semibold text-fg first:pt-0">
                  <SkeletonText width={g ? "20ch" : "22ch"} />
                </li>
                {Array.from({ length: n }, (_, i) => (
                  <li
                    key={i}
                    data-skeleton
                    aria-hidden
                    className="flex min-h-[4.5rem] items-center gap-1 rounded-xl border border-border bg-surface py-2 pr-1 pl-1 shadow-xs"
                  >
                    <span className="inline-flex size-9 shrink-0 items-center justify-center text-muted">
                      <GripVertical aria-hidden className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1">
                      <Skeleton variant="circle" className="size-10 shrink-0" />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-base leading-snug font-semibold text-fg">
                          <SkeletonText width={i % 2 ? "13ch" : "15ch"} />
                        </span>
                        <span className="truncate text-sm text-muted tabular-nums">
                          <SkeletonText width="15ch" />
                        </span>
                      </span>
                    </span>
                  </li>
                ))}
              </Fragment>
            ))
          : groups.map((g) => {
              const shown = g.ids.filter((id) => visible.has(id)).length;
              return (
                <MobileGroup key={g.key} group={g} shown={shown} onPage={g.ids.some(isShown)}>
                  {g.ids.map((id) => {
                    const row = byId.get(id);
                    if (!row) return null;
                    return (
                      <StaffMobileRow
                        key={id}
                        {...props}
                        row={row}
                        groupKey={g.key}
                        hidden={!isShown(id)}
                        reorderEnabled={reorderEnabled}
                        onHandlePointerDown={reorder.onPointerDown}
                        onHandleKeyDown={reorder.onKeyDown}
                      />
                    );
                  })}
                </MobileGroup>
              );
            })}
        {!loading && (
          <li hidden={anyVisible} className="rounded-xl border border-border bg-surface">
            <EmptyState variant="section" kind="search" title={t("empty.searchTitle")} compact />
          </li>
        )}
      </ul>

      {!loading && ordered.length > DEFAULT_PAGE_SIZE && (
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          total={ordered.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          className="mt-2"
        />
      )}
    </div>
  );
}

/** Скелетон: группы-должности как в демо (владелец, администраторы, мастера) */
const SKELETON_GROUPS = [1, 2, 3, 3];

function GroupRows({ group, shown, onPage, children }: { group: StaffGroup; shown: number; onPage: boolean; children: ReactNode }) {
  const t = useT("staff");
  return (
    <>
      <tr hidden={shown === 0 || !onPage} className={cn("border-t border-border bg-surface-2/40", ROW_FADE)}>
        <th scope="rowgroup" colSpan={9} className="h-10 px-4 text-left text-[13px] font-semibold text-fg">
          {group.label}
          <span className="font-normal text-muted"> · {t("table.groupCount", { n: shown })}</span>
        </th>
      </tr>
      {children}
    </>
  );
}

function MobileGroup({ group, shown, onPage, children }: { group: StaffGroup; shown: number; onPage: boolean; children: ReactNode }) {
  const t = useT("staff");
  return (
    <>
      <li hidden={shown === 0 || !onPage} className={cn("px-1 pt-2 text-[13px] font-semibold text-fg first:pt-0", ROW_FADE)}>
        {group.label}
        <span className="font-normal text-muted"> · {t("table.groupCount", { n: shown })}</span>
      </li>
      {children}
    </>
  );
}

interface RowProps extends StaffTeamTableProps {
  row: StaffListRow;
  groupKey: string;
  hidden: boolean;
  reorderEnabled: boolean;
  onHandlePointerDown: ReturnType<typeof useRowReorder>["onPointerDown"];
  onHandleKeyDown: ReturnType<typeof useRowReorder>["onKeyDown"];
}

function DragHandle({ row, reorderEnabled, onHandlePointerDown, onHandleKeyDown }: RowProps) {
  const t = useT("staff");
  if (!reorderEnabled) return <span aria-hidden className="inline-block size-9" />;
  return (
    <button
      type="button"
      data-f="F-10-009"
      aria-label={`${t("table.dragHandle")} — ${row.staff.name}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={onHandlePointerDown}
      onKeyDown={onHandleKeyDown}
      className="inline-flex size-10 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:bg-surface-3 hover:text-fg focus-visible:outline-2 focus-visible:outline-focus active:cursor-grabbing"
    >
      <GripVertical aria-hidden className="size-4" />
    </button>
  );
}

function StatusBadges({ row }: { row: StaffListRow }) {
  const t = useT("staff");
  const fmt = useFormat();
  const { staff, dismissal } = row;
  return (
    <>
      {staff.status === "invited" && <Badge tone="warning" size="sm">{t("status.invited")}</Badge>}
      {staff.status === "disabled" && <Badge tone="warning" size="sm">{t("status.disabled")}</Badge>}
      {dismissal?.scheduled && (
        <Badge tone="danger" size="sm">
          {t("status.leaving", { date: fmt.date(dismissal.date, "short").slice(0, 5) })}
        </Badge>
      )}
    </>
  );
}

function openOnKey(event: KeyboardEvent, open: () => void) {
  if (event.target !== event.currentTarget) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    open();
  }
}

function StaffTableRow(props: RowProps) {
  const { row, groupKey, hidden, canManage, locale, onOpen, onToggleOnline } = props;
  const t = useT("staff");
  const { staff } = row;
  return (
    <tr
      data-reorder-row={staff.id}
      data-reorder-group={groupKey}
      hidden={hidden}
      tabIndex={0}
      onClick={() => onOpen(row)}
      onKeyDown={(e) => openOnKey(e, () => onOpen(row))}
      className={cn(
        "group/row h-14 cursor-pointer border-t border-border bg-surface hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus data-[dragging]:shadow-lg",
        ROW_FADE,
      )}
    >
      <td className="px-2 align-middle">
        <DragHandle {...props} />
      </td>
      <td className="min-w-48 px-3 py-2 align-middle">
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={staff.name} src={staff.avatarUrl} colorIndex={staff.colorIndex} size="sm" />
          <span className="flex min-w-0 flex-col items-start gap-0.5">
            <span className="truncate font-medium text-fg">{staff.name}</span>
            {(staff.status !== "active" || row.dismissal?.scheduled || staff.role !== "master") && (
              <span className="flex flex-wrap gap-1">
                {staff.role !== "master" && (
                  <Badge tone={staff.role === "owner" ? "primary" : "info"} size="sm">
                    {t(`role.${staff.role}`)}
                  </Badge>
                )}
                <StatusBadges row={row} />
              </span>
            )}
          </span>
        </span>
      </td>
      <td className="max-w-40 px-3 py-2 align-middle text-sm text-muted">{staff.specialty ? pickText(staff.specialty, locale as "ru") : "—"}</td>
      <td className="px-3 py-2 align-middle">
        <ContactsCell row={row} />
      </td>
      <td className="px-3 py-2 align-middle whitespace-nowrap" data-f="F-02-022">
        {staff.role === "master" || row.servicesCount > 0 ? <ScheduleCell until={row.scheduleUntil} /> : <span className="text-muted">—</span>}
      </td>
      <td className="px-3 py-2 align-middle whitespace-nowrap">
        {staff.role === "master" || row.servicesCount > 0 ? <ServicesCell row={row} /> : <span className="text-muted">—</span>}
      </td>
      <td className="px-3 py-2 align-middle">
        <span data-f="F-10-011 F-02-068" onClick={(e) => e.stopPropagation()} className="inline-flex min-h-11 items-center">
          <Switch
            checked={staff.onlineBookingEnabled ?? true}
            disabled={!canManage}
            onCheckedChange={(checked) => onToggleOnline(row, checked)}
            aria-label={`${t("table.onlineBooking")} — ${staff.name}`}
          />
        </span>
      </td>
      <td className="px-3 py-2 align-middle" data-f="F-10-110 F-15-050">
        <SeatLabel seat={row.seat} stacked />
      </td>
      <td className="px-2 py-2 text-right align-middle">
        <StaffRowActions {...props} row={row} canManage={canManage} />
      </td>
    </tr>
  );
}

function StaffMobileRow(props: RowProps) {
  const { row, groupKey, hidden, canManage, onOpen } = props;
  const t = useT("staff");
  const fmt = useFormat();
  const { staff } = row;
  const contact = staff.phone ? fmt.phone(staff.phone) : (staff.email ?? "");
  const statusText =
    staff.status === "invited"
      ? t("status.invited")
      : staff.status === "disabled"
        ? t("status.disabled")
        : row.dismissal?.scheduled
          ? t("status.leaving", { date: fmt.date(row.dismissal.date, "short").slice(0, 5) })
          : "";
  return (
    <li
      data-reorder-row={staff.id}
      data-reorder-group={groupKey}
      data-f="F-10-023 F-10-132"
      hidden={hidden}
      className={cn("flex min-h-[4.5rem] items-center gap-1 rounded-xl border border-border bg-surface py-2 pr-1 pl-1 shadow-xs data-[dragging]:shadow-lg", ROW_FADE)}
    >
      <DragHandle {...props} />
      <button
        type="button"
        onClick={() => onOpen(row)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left active:bg-surface-2"
      >
        <Avatar name={staff.name} src={staff.avatarUrl} colorIndex={staff.colorIndex} size="md" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base leading-snug font-semibold text-fg">{staff.name}</span>
          <span className="truncate text-sm text-muted tabular-nums">
            {[contact, statusText].filter(Boolean).join(" · ") || "—"}
          </span>
        </span>
        {!canManage && <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />}
      </button>
      <StaffRowActions {...props} row={row} canManage={canManage} />
    </li>
  );
}
