"use client";

/**
 * /biz/payroll/analytics — фонд оплаты труда и риски (F-09-101, «встроенное» из AutoPayroll).
 * Принадлежит разделу «payroll». Без платных ограничений (F-09-103): раздел входит в подписку целиком.
 */
import { useState } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { getPayrollFundAnalytics } from "@/api/payroll";
import { useCoreList } from "@/api/core";
import { useApiQuery } from "@/api/request";
import { useCurrent } from "@/demo/hooks";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { Badge } from "@/ui/Badge";
import { Card } from "@/ui/Card";
import { DateRangePicker } from "@/ui/DateRangePicker";
import type { DateRange } from "@/ui/Calendar";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { PageHeader } from "@/ui/PageHeader";
import { SkeletonText } from "@/ui/Skeleton";
import { dayjs, toISODate, today } from "@/lib/date";

export function AnalyticsScreen() {
  const t = useT("payroll");
  const format = useFormat();
  const {
    ready,
    businessId,
    locationId: currentLocationId,
    activeLocationIds,
  } = useCurrent();
  const locationId =
    currentLocationId === "all" ? activeLocationIds[0] : currentLocationId;
  const staffQuery = useCoreList(
    "staff",
    { businessId },
    { enabled: ready && Boolean(businessId) },
  );
  const staffName = (id: string) =>
    staffQuery.data?.find((s) => s.id === id)?.name ?? id;
  // Зарплата-ревью З2: тот же период по умолчанию, что «Расчёт за период» (с 1-го по сегодня), — иначе
  // минимум за целый месяц давал здесь одну зарплату, а в периоде и ведомости — другую.
  const [range, setRange] = useState<DateRange>(() => ({
    from: toISODate(dayjs().startOf("month")),
    to: today(),
  }));
  const from = range.from ?? today();
  const to = range.to ?? from;
  const q = useApiQuery(
    ["payroll", "analytics", locationId, from, to],
    () => getPayrollFundAnalytics(locationId!, from, to),
    {
      enabled: ready && Boolean(locationId),
      keepPrevious: true,
    },
  );
  const loading = !ready || q.isLoading;
  const data = q.data;
  return (
    <div data-f="F-09-101 F-09-103" className="flex flex-col gap-6">
      <PageHeader
        title={t("analytics.title")}
        description={t("analytics.subtitle")}
      />
      <DateRangePicker value={range} onValueChange={setRange} max={today()} presets />

      {q.isError || (!loading && !q.data) ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : q.data && q.data.staffCount === 0 && q.data.fund === 0 ? (
        <EmptyState
          icon={<TrendingUp aria-hidden className="size-8 text-muted" />}
          title={t("analytics.empty")}
        />
      ) : (
        <>
          {/* Плитки — те же и при загрузке: подписи на месте, цифры полосой в той же строке */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-busy={loading || undefined}>
            <Card padding="sm" className="flex flex-col gap-1">
              <span className="text-xs text-muted">
                {t("analytics.turnover")}
              </span>
              <span className="text-lg font-semibold text-fg">
                {data ? format.money(data.turnover) : <SkeletonText width="10ch" />}
              </span>
            </Card>
            <Card padding="sm" className="flex flex-col gap-1">
              <span className="text-xs text-muted">{t("analytics.fund")}</span>
              <span className="text-lg font-semibold text-fg">
                {data ? format.money(data.fund) : <SkeletonText width="10ch" />}
              </span>
            </Card>
            <Card
              padding="sm"
              className={`flex flex-col gap-1 ${data?.overWarn ? "bg-danger/10" : ""}`}
            >
              <span className="text-xs text-muted">
                {t("analytics.fundShare")}
              </span>
              <span
                className={`text-lg font-semibold ${data?.overWarn ? "text-danger" : "text-fg"}`}
              >
                {data ? `${data.fundSharePct}%` : <SkeletonText width="4ch" />}
              </span>
              <span className="text-xs text-muted">
                {data ? t("analytics.target", { pct: data.targetPct }) : <SkeletonText width="9ch" />}
              </span>
            </Card>
            <Card padding="sm" className="flex flex-col gap-1">
              <span className="text-xs text-muted">
                {t("analytics.avgPayout")}
              </span>
              <span className="text-lg font-semibold text-fg">
                {data ? format.money(data.avgPayout) : <SkeletonText width="10ch" />}
              </span>
            </Card>
          </div>

          {!q.data ? (
            <AnalyticsListSkeleton />
          ) : (
          <>
          {q.data.overWarn && (
            <div
              data-f="F-09-101"
              className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm"
            >
              <AlertTriangle
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-danger"
              />
              <p className="text-fg">
                {t("analytics.warnOverThreshold", {
                  pct: q.data.fundSharePct,
                  warnPct: q.data.warnPct,
                })}
              </p>
            </div>
          )}

          {q.data.topAccruals.length > 0 && (
            <Card padding="sm" className="flex flex-col gap-2">
              <span className="text-sm font-medium text-fg">
                {t("analytics.topAccruals")}
              </span>
              {q.data.topAccruals.map((row) => (
                <div
                  key={row.staffId}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted">{staffName(row.staffId)}</span>
                  <span className="font-medium tabular-nums text-fg">
                    {format.money(row.amount)}
                  </span>
                </div>
              ))}
            </Card>
          )}

          {q.data.risks.length > 0 && (
            <Card
              data-f="F-09-101"
              padding="sm"
              className="flex flex-col gap-2"
            >
              <span className="text-sm font-medium text-fg">
                {t("analytics.risksTitle")}
              </span>
              {q.data.risks.map((r) => (
                <div
                  key={r.key}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted">
                    {t(`analytics.risk.${r.key}`)}
                  </span>
                  <Badge tone="warning">{r.count}</Badge>
                </div>
              ))}
            </Card>
          )}
          </>
          )}
        </>
      )}
    </div>
  );
}

/** Скелетон «Топ начислений» — та же карточка: заголовок и строки «сотрудник · сумма» */
function AnalyticsListSkeleton() {
  const t = useT("payroll");
  return (
    <>
    <Card padding="sm" className="flex flex-col gap-2">
      <span className="text-sm font-medium text-fg">
        {t("analytics.topAccruals")}
      </span>
      {["14ch", "11ch", "16ch", "12ch", "10ch"].map((w) => (
        <div key={w} className="flex items-center justify-between text-sm">
          <span className="text-muted">
            <SkeletonText width={w} />
          </span>
          <span className="font-medium tabular-nums text-fg">
            <SkeletonText width="9ch" />
          </span>
        </div>
      ))}
    </Card>
    {/* «Риски»: в демо почти всегда есть сотрудники без схемы — одна строка со счётчиком */}
    <Card padding="sm" className="flex flex-col gap-2">
      <span className="text-sm font-medium text-fg">
        {t("analytics.risksTitle")}
      </span>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">
          <SkeletonText width="20ch" />
        </span>
        <Badge tone="warning">
          <SkeletonText width="1ch" />
        </Badge>
      </div>
    </Card>
    </>
  );
}

