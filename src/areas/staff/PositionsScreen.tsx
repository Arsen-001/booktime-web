"use client";

/**
 * /biz/staff/positions — каталог должностей (F-10-046…050): список со счётчиком сотрудников, создать,
 * изменить (название + описание — та же форма), удалить (запрещено, если на должности есть сотрудники —
 * показываем, кто именно).
 */
import { useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import {
  listPositionRows,
  removePosition,
  type PositionRow,
} from "@/api/staff";
import { ApiError, useApiMutation, useApiQuery } from "@/api/request";
import {
  AddPositionModal,
  type EditingPosition,
} from "@/areas/staff/components/AddPositionModal";
import { NoAccessState } from "@/areas/staff/components/NoAccessState";
import { useCan, useCurrent } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { IconButton } from "@/ui/IconButton";
import { PageHeader } from "@/ui/PageHeader";
import { Reveal } from "@/ui/Reveal";
import { SkeletonText } from "@/ui/Skeleton";
import { useSkeletonCount } from "@/ui/hooks/useSkeletonCount";
import { useConfirm, useToast } from "@/ui/Toast";

export function PositionsScreen() {
  const t = useT("staff");
  const toast = useToast();
  const confirm = useConfirm();
  const { ready, businessId } = useCurrent();
  // Как список и «Роли»: без staff.view — «Доступ запрещён»; менять каталог — только со staff.manage
  const canView = useCan("staff.view");
  const canManage = useCan("staff.manage");
  const enabled = ready && Boolean(businessId) && canView;
  const q = useApiQuery(
    ["staff", "positionRows", businessId],
    () => listPositionRows(businessId!),
    { enabled },
  );
  const remove = useApiMutation(removePosition);
  const skeletonRows = useSkeletonCount("positions", { loading: q.isLoading, count: q.data?.length, fallback: 6, max: 20 });
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<EditingPosition | null>(null);

  const openEdit = (row: PositionRow) => {
    if (!canManage) return;
    setEditing({ id: row.id, name: row.name.ru, description: row.description });
    setAddOpen(true);
  };

  const askRemove = async (row: PositionRow) => {
    if (row.staffCount > 0) {
      // F-10-049 «Готово, когда»: пользователь видит, кто числится на должности — тостом, без диалога
      // с несуществующим единственным действием (наши модалки не рисуют «ОК без отмены»).
      toast.error(
        t("positions.removeInUse", { names: row.staffNames.join(", ") }),
      );
      return;
    }
    const ok = await confirm({
      title: t("positions.removeTitle", { name: row.name.ru }),
      description: t("positions.removeText"),
      confirmLabel: t("positions.remove"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await remove.mutate(row.id);
      toast.success(t("positions.removed", { name: row.name.ru }));
      q.refetch();
    } catch (e) {
      if (e instanceof ApiError && e.code === "in_use") {
        toast.error(t("positions.removeInUse", { names: e.message }));
      } else {
        toast.error(t("positions.removeFailed"));
      }
    }
  };

  if (ready && !canView) return <NoAccessState />;

  return (
    <div
      data-f="F-10-046 F-10-050"
      className="flex w-full flex-col gap-4 md:gap-6"
    >
      <PageHeader
        title={t("nav.positions")}
        description={
          <span className="max-md:hidden">{t("positions.subtitle")}</span>
        }
        actions={
          canManage ? (
            <Button
              leftIcon={<Plus aria-hidden />}
              onClick={() => {
                setEditing(null);
                setAddOpen(true);
              }}
            >
              {t("addMenu.position")}
            </Button>
          ) : undefined
        }
      />
      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <Reveal
          loading={q.isLoading}
          skeleton={<PositionsSkeleton rows={skeletonRows} />}
        >
          {(q.data ?? []).length === 0 ? (
            <EmptyState
              title={t("positions.empty")}
              description={t("positions.emptyHint")}
              action={
                canManage ? (
                  <Button
                    onClick={() => {
                      setEditing(null);
                      setAddOpen(true);
                    }}
                  >
                    {t("addMenu.position")}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {(q.data ?? []).map((p) => (
                <li
                  key={p.id}
                  data-f="F-10-047 F-10-049"
                  className="flex min-h-16 items-center justify-between gap-3 px-4 py-2 transition-colors hover:bg-surface-2"
                >
                  <button
                    type="button"
                    disabled={!canManage}
                    className="flex min-h-11 min-w-0 flex-1 flex-col items-start rounded-md text-left focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-default"
                    onClick={() => openEdit(p)}
                  >
                    <span className="font-medium text-fg">{p.name.ru}</span>
                    {p.description && (
                      <span className="truncate text-xs text-muted">
                        {p.description}
                      </span>
                    )}
                  </button>
                  <Badge
                    tone="neutral"
                    variant="soft"
                    size="sm"
                    icon={<Users aria-hidden />}
                  >
                    {t("positions.staffCount", { count: p.staffCount })}
                  </Badge>
                  {canManage && (
                    <IconButton
                      icon={<Trash2 aria-hidden />}
                      label={t("positions.remove")}
                      variant="ghost"
                      size="sm"
                      onClick={() => void askRemove(p)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      )}
      <AddPositionModal
        open={addOpen}
        onOpenChange={setAddOpen}
        businessId={businessId}
        editing={editing}
        onCreated={() => q.refetch()}
      />
    </div>
  );
}

/** Список должностей до загрузки — та же рамка и строки 64 px: название, плашка «N сотрудников», корзина */
function PositionsSkeleton({ rows }: { rows: number }) {
  return (
    <ul aria-busy className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex min-h-16 items-center justify-between gap-3 px-4 py-2">
          <span className="flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center">
            <span className="font-medium text-fg">
              <SkeletonText width={i % 2 ? "10ch" : "14ch"} />
            </span>
          </span>
          <Badge tone="neutral" variant="soft" size="sm" icon={<Users aria-hidden />}>
            <SkeletonText width="11ch" />
          </Badge>
          <span aria-hidden className="size-10 shrink-0 md:size-9" />
        </li>
      ))}
    </ul>
  );
}
