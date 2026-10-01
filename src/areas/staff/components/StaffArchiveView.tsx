"use client";

/**
 * Архив (С3, С4 обзора «Сотрудники»): уволенные — с датой и причиной, «Вернуть на работу» в любой момент (без
 * блокировки 30 дней); «Удалить навсегда» — только здесь, не рядом с «Уволить». Ниже — удалённые карточки с
 * «Вернуть» (restoreDeletedStaff — функция была, но ни один экран её не звал).
 */
import { MoreHorizontal, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { listDeletedStaff, type StaffListRow } from "@/api/staff";
import { useApiQuery } from "@/api/request";
import type { DeletedStaffSnapshot } from "@/domain/staff";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { DropdownMenu } from "@/ui/DropdownMenu";
import { EmptyState } from "@/ui/EmptyState";
import { usePagedList } from "@/ui/Pagination";
import { IconButton } from "@/ui/IconButton";
import { SectionCard } from "@/ui/SectionCard";
import { Skeleton } from "@/ui/Skeleton";

export interface StaffArchiveViewProps {
  businessId: string;
  fired: StaffListRow[];
  loading: boolean;
  canManage: boolean;
  busyId: string | null;
  onOpen: (row: StaffListRow) => void;
  onRestore: (row: StaffListRow) => void;
  onDelete: (row: StaffListRow) => void;
  onRestoreDeleted: (snapshot: DeletedStaffSnapshot) => void;
}

export function StaffArchiveView({
  businessId,
  fired,
  loading,
  canManage,
  busyId,
  onOpen,
  onRestore,
  onDelete,
  onRestoreDeleted,
}: StaffArchiveViewProps) {
  const t = useT("staff");
  const fmt = useFormat();
  const deletedQ = useApiQuery(["staff", "deleted", businessId], () => listDeletedStaff(businessId));
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: firedPage, pager: firedPager } = usePagedList(fired);
  const { pageItems: deletedPage, pager: deletedPager } = usePagedList(deletedQ.data ?? []);

  return (
    <div data-f="F-10-007 F-10-044" className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">{t("archive.hint")}</p>
      <SectionCard title={t("archive.firedTitle")}>
        {loading ? (
          <ul data-skeleton className="flex flex-col divide-y divide-border">
            {Array.from({ length: 2 }, (_, i) => (
              <li key={i} className="flex h-16 items-center gap-3">
                <Skeleton variant="circle" className="size-10" />
                <span className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3.5 w-56" />
                </span>
              </li>
            ))}
          </ul>
        ) : fired.length === 0 ? (
          <EmptyState variant="section" compact title={t("archive.empty")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {firedPage.map((row) => {
              const d = row.dismissal;
              const firedOn = d?.firedAt ?? d?.date;
              return (
                <li key={row.staff.id} className="flex min-h-16 flex-wrap items-center gap-3 py-2">
                  <button type="button" onClick={() => onOpen(row)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left">
                    <Avatar name={row.staff.name} src={row.staff.avatarUrl} colorIndex={row.staff.colorIndex} size="md" />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium text-fg">{row.staff.name}</span>
                      <span className="text-sm text-muted">
                        {[row.positionLabel, firedOn ? t("archive.firedAt", { date: fmt.date(firedOn, "short") }) : t("status.fired"), d?.reason ? t("archive.reason", { reason: d.reason }) : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                  {canManage && (
                    <span className="flex items-center gap-1">
                      <Button size="sm" variant="outline" leftIcon={<RotateCcw aria-hidden />} loading={busyId === row.staff.id} onClick={() => onRestore(row)}>
                        {t("archive.restore")}
                      </Button>
                      <DropdownMenu
                        trigger={(p) => <IconButton icon={<MoreHorizontal aria-hidden />} label={t("row.menu")} variant="ghost" size="sm" {...p} />}
                        items={[
                          {
                            id: "delete",
                            label: t("archive.deleteForever"),
                            icon: <Trash2 aria-hidden />,
                            danger: true,
                            onSelect: () => onDelete(row),
                          },
                        ]}
                        align="end"
                        label={row.staff.name}
                      />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!loading && firedPager && <div className="mt-4">{firedPager}</div>}
      </SectionCard>

      <SectionCard title={t("archive.deletedTitle")}>
        {deletedQ.isLoading ? (
          <div data-skeleton className="flex h-16 items-center gap-3">
            <Skeleton variant="circle" className="size-10" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : (deletedQ.data ?? []).length === 0 ? (
          <p className="py-2 text-sm text-muted">{t("archive.deletedEmpty")}</p>
        ) : (
          <ul data-f="F-10-131" className="flex flex-col divide-y divide-border">
            {deletedPage.map((d) => (
              <li key={d.id} className="flex min-h-16 flex-wrap items-center gap-3 py-2">
                <Avatar name={d.snapshot.name} src={d.snapshot.avatarUrl} colorIndex={d.snapshot.colorIndex} size="md" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium text-fg">{d.snapshot.name}</span>
                  <span className="text-sm text-muted">{t("archive.deletedAt", { date: fmt.date(d.deletedAt.slice(0, 10), "short") })}</span>
                </span>
                {canManage && (
                  <Button size="sm" variant="outline" leftIcon={<Undo2 aria-hidden />} loading={busyId === d.id} onClick={() => onRestoreDeleted(d)}>
                    {t("archive.restoreDeleted")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {deletedPager && <div className="mt-4">{deletedPager}</div>}
      </SectionCard>
    </div>
  );
}
