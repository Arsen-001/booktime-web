"use client";

/**
 * /biz/network/settings/plans — планы по локациям и месяцам (F-11-077): вводишь число — сохраняется само.
 */
import { useMemo, useState } from "react";
import { dayjs } from "@/lib/date";
import {
  listNetworkLocations,
  listNetworkPlans,
  setNetworkPlanCell,
} from "@/api/network";
import { useApiMutation, useApiQuery } from "@/api/request";
import type { Id, ISODate } from "@/domain/core";
import type { NetworkPlanKind } from "@/domain/network";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { Input } from "@/ui/Input";
import { PageHeader } from "@/ui/PageHeader";
import { SectionCard } from "@/ui/SectionCard";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { SkeletonText } from "@/ui/Skeleton";
import { useSkeletonCount } from "@/ui/hooks/useSkeletonCount";
import { NetworkPageActions } from "@/areas/network/NetworkPageHelp";
import { useNetwork } from "@/areas/network/lib/useNetwork";

const KINDS: NetworkPlanKind[] = ["revenue", "clients", "avgCheck"];

function nextMonths(count: number): string[] {
  const start = dayjs();
  return Array.from({ length: count }, (_, i) =>
    start.add(i, "month").format("YYYY-MM"),
  );
}

/**
 * Фиксированная раскладка: колонка филиала 12rem (название в одну строку, многоточием), месяцы делят остальное —
 * ширины и высота строк не зависят от данных, скелетон и таблица с данными совпадают.
 */
const PLANS_TABLE = "w-full min-w-[880px] table-fixed border-collapse text-sm";
const NAME_TH = "sticky left-0 z-10 w-48 bg-surface px-4 py-2.5";
const NAME_TD = "sticky left-0 z-10 truncate bg-surface px-4 py-2 font-medium text-fg";

export function PlansScreen() {
  const t = useT("network");
  const format = useFormat();
  const { ready, networkId, isError, refetch } = useNetwork();
  const [kind, setKind] = useState<NetworkPlanKind>("revenue");
  const months = useMemo(() => nextMonths(6), []);
  const locationsQ = useApiQuery(
    ["network", "locations", networkId],
    () => listNetworkLocations(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const plansQ = useApiQuery(
    ["network", "plans", networkId],
    () => listNetworkPlans(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const mutation = useApiMutation(setNetworkPlanCell);
  // Поля плана берут значение при появлении (defaultValue) — ждём и планы, иначе они остались бы пустыми
  const loading = !ready || locationsQ.isLoading || plansQ.isLoading;
  const skeletonRows = useSkeletonCount("networkPlans", { loading, count: locationsQ.data?.length, fallback: 2, max: 20 });

  if (isError || locationsQ.isError || plansQ.isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  const valueOf = (businessId: Id, month: string) =>
    plansQ.data?.find(
      (p) =>
        p.businessId === businessId && p.kind === kind && p.month === month,
    )?.value ?? "";

  const commit = (businessId: Id, month: string, raw: string) => {
    const value = Number(raw.replace(/[^\d]/g, "")) || 0;
    void mutation
      .mutate({ networkId: networkId!, businessId, kind, month, value })
      .then(() => plansQ.refetch());
  };

  return (
    <div
      data-f="F-11-077"
      className="flex w-full flex-col gap-6"
    >
      <PageHeader
        title={t("settingsPlans.title")}
        description={t("settingsPlans.subtitle")}
        actions={
          <NetworkPageActions
            titleKey="help.settingsPlans.title"
            bodyKey="help.settingsPlans.body"
          />
        }
      />

      <SectionCard title={t("settingsPlans.kindLabel")}>
        <SegmentedControl
          options={KINDS.map((k) => ({
            value: k,
            label: t(`settingsPlans.kind.${k}` as const),
          }))}
          value={kind}
          onValueChange={(v) => setKind(v as NetworkPlanKind)}
        />
      </SectionCard>

      <SectionCard title={t("settingsPlans.tableTitle")} padding="none">
        {loading ? (
          // Скелетон = та же таблица: шапка с месяцами, строки филиалов с полями (неактивными)
          <div aria-hidden className="main-scrollbar overflow-x-auto">
            <table className={PLANS_TABLE}>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className={NAME_TH}>
                    {t("settingsPlans.colLocation")}
                  </th>
                  {months.map((m) => (
                    <th key={m} className="px-2 py-2.5 text-center font-medium">
                      {format.date(`${m}-01` as ISODate, "monthYear")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: skeletonRows }, (_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className={NAME_TD}>
                      <SkeletonText width={i % 2 ? "12ch" : "15ch"} />
                    </td>
                    {months.map((m) => (
                      <td key={m} className="px-2 py-2">
                        <Input size="sm" disabled value="" readOnly className="mx-auto w-24 text-center" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !locationsQ.data?.length ? (
          <div className="p-5">
            <EmptyState compact title={t("settingsPlans.empty")} />
          </div>
        ) : (
          <div className="main-scrollbar overflow-x-auto">
            <table className={PLANS_TABLE}>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className={NAME_TH}>
                    {t("settingsPlans.colLocation")}
                  </th>
                  {months.map((m) => (
                    <th key={m} className="px-2 py-2.5 text-center font-medium">
                      {format.date(`${m}-01` as ISODate, "monthYear")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {locationsQ.data.map((row) => (
                  <tr
                    key={row.business.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className={NAME_TD}>
                      {row.business.name}
                    </td>
                    {months.map((m) => (
                      <td key={m} className="px-2 py-2">
                        <Input
                          size="sm"
                          inputMode="numeric"
                          defaultValue={String(valueOf(row.business.id, m))}
                          onBlur={(e) =>
                            commit(row.business.id, m, e.target.value)
                          }
                          className="mx-auto w-24 text-center"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
