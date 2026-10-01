"use client";

/**
 * Карточка сотрудника → «Уведомления», когда её открывает САМ мастер, у которого нет права
 * `notify.manage` (F-10-137: «сотрудник в приложении включает только те push, что разрешил владелец»).
 * Полная матрица «тип × канал» — вклад notify (ExtensionSlot, F-05-055…057), виден только тому, у кого
 * есть право на неё; здесь — упрощённая витрина «на себя», построенная staff, читает ту же матрицу
 * notify (только для чтения, канал push) и переключает СВОИ личные пуши в своём срезе.
 */
import { BellOff } from "lucide-react";
import { getStaffNotifyPrefs } from "@/api/notify";
import { getMasterPushPrefs, setMasterPushPref } from "@/api/staff";
import { useApiMutation, useApiQuery } from "@/api/request";
import { STAFF_NOTIFY_EVENTS } from "@/domain/notify";
import type { Id } from "@/domain/core";
import { useT } from "@/i18n/useT";
import { EmptyState } from "@/ui/EmptyState";
import { Skeleton } from "@/ui/Skeleton";
import { Switch } from "@/ui/Switch";

export function StaffOwnNotifyTab({ staffId }: { staffId: Id }) {
  const t = useT("staff");
  const allowedQ = useApiQuery(["notify", "staffPrefs", staffId], () =>
    getStaffNotifyPrefs(staffId),
  );
  const ownQ = useApiQuery(["staff", "masterPushPrefs", staffId], () =>
    getMasterPushPrefs(staffId),
  );
  const toggle = useApiMutation((args: { event: string; value: boolean }) =>
    setMasterPushPref(staffId, args.event, args.value),
  );

  if (allowedQ.isLoading || ownQ.isLoading) return <Skeleton lines={4} />;

  const allowedEvents = STAFF_NOTIFY_EVENTS.filter(
    (e) => allowedQ.data?.matrix[e]?.push,
  );
  if (allowedEvents.length === 0) {
    return (
      <EmptyState
        compact
        icon={<BellOff aria-hidden />}
        title={t("ownNotifyTab.emptyTitle")}
        description={t("ownNotifyTab.emptyText")}
      />
    );
  }

  return (
    <div data-f="F-10-137" className="flex flex-col gap-1">
      <p className="mb-2 text-sm text-muted">{t("ownNotifyTab.hint")}</p>
      {allowedEvents.map((event) => (
        <div
          key={event}
          className="flex min-h-11 items-center justify-between gap-3 border-b border-border py-2 last:border-0"
        >
          <span className="text-sm text-fg">
            {t(`ownNotifyTab.event.${event}` as never)}
          </span>
          <Switch
            checked={ownQ.data?.[event] ?? false}
            disabled={toggle.isPending}
            onCheckedChange={(v) =>
              void toggle.mutate({ event, value: v }).then(() => ownQ.refetch())
            }
          />
        </div>
      ))}
    </div>
  );
}
