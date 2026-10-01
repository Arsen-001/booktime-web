"use client";

/**
 * Сеть14: сводные финансы сети на обзоре — по филиалам за период (этот месяц по умолчанию) с итогом, и ссылка
 * на сводный склад сети (/biz/network/goods/stock). Свой запрос и свой скелетон — соседние блоки обзора не ждут.
 */
import { Warehouse } from "lucide-react";
import { useState } from "react";
import { getNetworkFinanceSummary } from "@/api/network";
import { useApiQuery } from "@/api/request";
import type { Id } from "@/domain/core";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { today } from "@/lib/date";
import { LinkButton } from "@/ui/Button";
import type { DateRange } from "@/ui/Calendar";
import { DateRangePicker } from "@/ui/DateRangePicker";
import { SectionCard } from "@/ui/SectionCard";
import { SkeletonText } from "@/ui/Skeleton";
import { useSkeletonCount } from "@/ui/hooks/useSkeletonCount";

export function NetworkFinanceCard({ networkId, enabled }: { networkId: Id | undefined; enabled: boolean }) {
  const t = useT("network");
  const format = useFormat();
  const [range, setRange] = useState<DateRange>(() => ({ from: `${today().slice(0, 8)}01`, to: today() }));
  const [applied, setApplied] = useState(range);
  const q = useApiQuery(
    ["network", "financeSummary", networkId, applied.from, applied.to],
    () => getNetworkFinanceSummary(networkId!, applied.from!, applied.to!),
    { enabled: enabled && Boolean(networkId) && Boolean(applied.from && applied.to) },
  );
  const rows = q.data ?? [];
  // Пока сеть не известна, запрос выключен (isLoading = false) — это тоже загрузка, а не «пустой итог»
  const loading = !q.data && (q.isLoading || !enabled || !networkId);
  const skeletonRows = useSkeletonCount("networkFinance", { loading, count: q.data?.length, fallback: 2, max: 20 });
  const bar = (width: string) => (loading ? <SkeletonText width={width} /> : null);
  const total = rows.reduce(
    (acc, r) => ({ revenue: acc.revenue + r.revenue, visits: acc.visits + r.visits, cancelled: acc.cancelled + r.cancelled }),
    { revenue: 0, visits: 0, cancelled: 0 },
  );

  return (
    <SectionCard
      title={t("overview.financeTitle")}
      description={t("overview.financeSubtitle")}
      actions={
        <LinkButton href="/biz/network/goods/stock" variant="ghost" size="sm" leftIcon={<Warehouse aria-hidden />}>
          {t("overview.stockLink")}
        </LinkButton>
      }
    >
      <div className="mb-3 w-full sm:w-72">
        <DateRangePicker
          value={range}
          onValueChange={(r) => {
            setRange(r);
            if (r.from && r.to) setApplied(r);
          }}
          presets
        />
      </div>
      {/* Скелетон = та же таблица: строки филиалов и итог, значения — полосами */}
      <div className="main-scrollbar overflow-x-auto" aria-busy={loading || undefined}>
        {/* Фиксированная раскладка: ширины колонок не зависят от чисел — скелетон и данные совпадают */}
        <table className="w-full min-w-[480px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="w-[34%] py-2">{t("overview.financeBranch")}</th>
              <th className="py-2 text-right">{t("overview.financeRevenue")}</th>
              <th className="py-2 text-right">{t("overview.financeVisits")}</th>
              <th className="py-2 text-right">{t("overview.financeAvgCheck")}</th>
              <th className="py-2 text-right">{t("overview.financeCancelled")}</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={i} aria-hidden className="border-b border-border">
                  <td className="truncate py-2 font-medium text-fg">{bar(i % 2 ? "14ch" : "18ch")}</td>
                  <td className="py-2 text-right">{bar("9ch")}</td>
                  <td className="py-2 text-right">{bar("3ch")}</td>
                  <td className="py-2 text-right">{bar("8ch")}</td>
                  <td className="py-2 text-right">{bar("2ch")}</td>
                </tr>
              ))}
            {rows.map((r) => (
              <tr key={r.businessId} className="border-b border-border">
                <td className="truncate py-2 font-medium text-fg">{r.businessName}</td>
                <td className="py-2 text-right">{format.money(r.revenue)}</td>
                <td className="py-2 text-right">{r.visits}</td>
                <td className="py-2 text-right">{format.money(r.avgCheck)}</td>
                <td className="py-2 text-right">{r.cancelled}</td>
              </tr>
            ))}
            <tr>
              <td className="pt-2 font-semibold text-fg">{t("overview.financeTotal")}</td>
              <td className="pt-2 text-right font-semibold text-fg">{bar("10ch") ?? format.money(total.revenue)}</td>
              <td className="pt-2 text-right font-semibold text-fg">{bar("3ch") ?? total.visits}</td>
              <td className="pt-2 text-right font-semibold text-fg">
                {bar("8ch") ?? format.money(total.visits ? Math.round(total.revenue / total.visits) : 0)}
              </td>
              <td className="pt-2 text-right font-semibold text-fg">{bar("2ch") ?? total.cancelled}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
