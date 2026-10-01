"use client";

/**
 * /biz/network/clients/log — журнал выгрузок сети (F-11-076): кто, когда, что; ссылка живёт месяц (F-11-044).
 */
import { FileClock } from "lucide-react";
import { listNetworkExportLog } from "@/api/network";
import { useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { Badge } from "@/ui/Badge";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { PageHeader } from "@/ui/PageHeader";
import { usePagedList } from "@/ui/Pagination";
import { SectionCard } from "@/ui/SectionCard";
import { Skeleton } from "@/ui/Skeleton";
import { useNetwork } from "@/areas/network/lib/useNetwork";

export function ExportLogScreen() {
  const t = useT("network");
  const format = useFormat();
  const { ready, networkId, isError, refetch } = useNetwork();
  const q = useApiQuery(
    ["network", "exportLog", networkId],
    () => listNetworkExportLog(networkId!),
    { enabled: ready && Boolean(networkId) },
  );

  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);

  if (isError || q.isError)
    return <ErrorState onRetry={() => (isError ? refetch() : q.refetch())} />;

  const rows = q.data ?? [];

  return (
    <div data-f="F-11-076" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t("clients.exportLogTitle")}
        back={{ href: "/biz/network/clients", label: t("clientCard.back") }}
      />
      <SectionCard title={t("clients.exportLogTitle")} padding="none">
        {!ready || q.isLoading ? (
          <div className="p-5">
            <Skeleton lines={4} />
          </div>
        ) : !rows.length ? (
          <div className="p-5">
            <EmptyState icon={<FileClock aria-hidden />} title={t("clients.exportLogEmpty")} />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {pageItems.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-fg">
                      {t("clients.exportLogRow", {
                        kind: t(`clients.exportKind.${r.kind}` as const),
                        count: r.count,
                        author: r.authorName,
                      })}
                    </span>
                    <span className="text-xs text-muted">
                      {format.date(r.at.slice(0, 10))} · {format.time(r.at)}
                    </span>
                  </div>
                  <Badge tone={r.expiresAt > new Date().toISOString() ? "success" : "neutral"} size="sm">
                    {format.date(r.expiresAt.slice(0, 10))}
                  </Badge>
                </li>
              ))}
            </ul>
            {pager && <div className="border-t border-border px-4 py-3">{pager}</div>}
          </>
        )}
      </SectionCard>
    </div>
  );
}
