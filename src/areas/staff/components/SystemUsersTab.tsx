"use client";

/**
 * Вкладка «Системные пользователи» (F-10-010, F-13-019): технические аккаунты подключённых интеграций.
 * F-13-019 (integrations, второй проход 26.09): раньше список читался из независимого мокапа
 * `staff.systemUsers` (`@/api/staff`), никак не связанного с реальным подключением приложений в
 * «Интеграциях» — «Готово, когда» («появляется при подключении, исчезает при отключении») не выполнялось.
 * Теперь список строится из НАСТОЯЩИХ подключённых `AppInstall` (`listSystemUsers()` из
 * `@/api/integrations`, по каждому активному филиалу) — пропадает сам при отключении/автоотключении.
 */
import { Bot } from "lucide-react";
import { listSystemUsers } from "@/api/integrations";
import { useApiQuery } from "@/api/request";
import type { Id } from "@/domain/core";
import { useT } from "@/i18n/useT";
import { Badge } from "@/ui/Badge";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { SectionCard } from "@/ui/SectionCard";
import { Skeleton } from "@/ui/Skeleton";

export function SystemUsersTab({ locationIds }: { locationIds: Id[] }) {
  const t = useT("staff");
  const q = useApiQuery(
    ["integrations", "systemUsers", locationIds],
    async () => (await Promise.all(locationIds.map((id) => listSystemUsers(id)))).flat(),
    { enabled: locationIds.length > 0 },
  );

  if (q.isLoading)
    return <Skeleton variant="rect" className="h-40 w-full rounded-xl" />;
  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  const users = q.data ?? [];
  if (users.length === 0) {
    return (
      <EmptyState
        variant="section"
        icon={<Bot aria-hidden />}
        title={t("systemUsers.empty")}
        description={t("systemUsers.emptyHint")}
      />
    );
  }
  return (
    <div data-f="F-10-010 F-13-019" className="flex flex-col gap-3">
      {users.map((u) => (
        <SectionCard
          key={u.id}
          title={u.appName}
          description={t("systemUsers.demo")}
        >
          <div className="flex flex-col gap-2" data-f="F-10-117 F-13-019">
            <Badge tone={u.billedInSubscription ? "warning" : "success"} size="sm" className="w-fit">
              {t(u.billedInSubscription ? "systemUsers.paidBadge" : "systemUsers.freeBadge")}
            </Badge>
            <div className="flex flex-wrap gap-1.5">
              {u.grantedScopes.map((p) => (
                <Badge key={p} tone="neutral">
                  {p}
                </Badge>
              ))}
            </div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
