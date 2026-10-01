"use client";

/**
 * Вкладки аналитики сети сверх сводного отчёта (F-11-065…068, F-11-069…071, F-11-072).
 * Файл принадлежит разделу network — src/areas/network/analytics/*.
 */
import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { dayjs } from "@/lib/date";
import {
  exportNetworkClients,
  getNetworkAnalyticsSettings,
  getNetworkDailyDetail,
  getNetworkHrReport,
  getNetworkLocationsDetail,
  getNetworkParamSeries,
  getNetworkPlanExecution,
  getNetworkServicesReport,
  getNetworkStaffReport,
  listNetworkSubdivisions,
  setNetworkLostClientDays,
  NETWORK_PARAM_METRICS,
  type NetworkParamMetric,
} from "@/api/network";
import { getPlanEmailSchedule, setPlanEmailSchedule } from "@/api/reports";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useCoreGet } from "@/api/core";
import { useCurrent } from "@/demo/hooks";
import type { Id, ISODate } from "@/domain/core";
import type { NetworkPlanKind } from "@/domain/network";
import type { PlanEmailSchedule } from "@/domain/reports";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { Input } from "@/ui/Input";
import { SectionCard } from "@/ui/SectionCard";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { Select } from "@/ui/Select";
import { Skeleton } from "@/ui/Skeleton";
import { useToast } from "@/ui/Toast";

const KINDS: NetworkPlanKind[] = ["revenue", "clients", "avgCheck"];

/** Наши окна и поля, не системные (CONVENTIONS §0.3): месяц выбираем Select'ом, не `<input type="month">` */
function monthOptions(): { value: string; label: string }[] {
  const start = dayjs().subtract(3, "month");
  return Array.from({ length: 10 }, (_, i) => {
    const d = start.add(i, "month");
    return { value: d.format("YYYY-MM"), label: d.locale("ru").format("MMMM YYYY") };
  });
}

function ExportButton({ onExport }: { onExport: () => void }) {
  const t = useT("network");
  return (
    <Button variant="outline" size="sm" leftIcon={<FileSpreadsheet aria-hidden />} onClick={onExport}>
      {t("analytics.exportExcel")}
    </Button>
  );
}

function useExport(networkId: Id, kind: "records" | "clients" | "staff") {
  const t = useT("network");
  const toast = useToast();
  const { staffId } = useCurrent();
  const meQ = useCoreGet("staff", staffId ?? undefined, { enabled: Boolean(staffId) });
  const mutation = useApiMutation(exportNetworkClients);
  return async (count: number) => {
    try {
      await mutation.mutate({
        networkId,
        scope: "all",
        count,
        authorName: meQ.data?.name ?? t("clientCard.title"),
        kind,
      });
      toast.success(t("clients.exportSent"));
    } catch {
      toast.error(t("clients.exportFailed"));
    }
  };
}

export function LocationsDetailTab({ networkId, from, to }: { networkId: Id; from: ISODate; to: ISODate }) {
  const t = useT("network");
  const format = useFormat();
  const [subdivisionId, setSubdivisionId] = useState("");
  const subdivisionsQ = useApiQuery(["network", "subdivisions", networkId], () => listNetworkSubdivisions(networkId));
  const q = useApiQuery(
    ["network", "locationsDetail", networkId, from, to, subdivisionId],
    () => getNetworkLocationsDetail(networkId, from, to, subdivisionId || undefined),
  );
  const runExport = useExport(networkId, "records");

  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      servicesRevenue: acc.servicesRevenue + r.servicesRevenue,
      goodsRevenue: acc.goodsRevenue + r.goodsRevenue,
      newClients: acc.newClients + r.newClients,
      notNewClients: acc.notNewClients + r.notNewClients,
      totalBookings: acc.totalBookings + r.totalBookings,
      cancelled: acc.cancelled + r.cancelled,
      completed: acc.completed + r.completed,
      pending: acc.pending + r.pending,
    }),
    { revenue: 0, servicesRevenue: 0, goodsRevenue: 0, newClients: 0, notNewClients: 0, totalBookings: 0, cancelled: 0, completed: 0, pending: 0 },
  );

  return (
    <div data-f="F-12-093" className="flex flex-col gap-4">
      <SectionCard
        title={t("analytics.tabs.locations")}
        actions={<ExportButton onExport={() => runExport(rows.length)} />}
      >
        <div className="mb-4 max-w-xs">
          <Select
            options={[
              { value: "", label: t("analytics.locationsSubdivisionAny") },
              ...(subdivisionsQ.data ?? []).map((s) => ({ value: s.id, label: s.name })),
            ]}
            value={subdivisionId}
            onValueChange={setSubdivisionId}
            placeholder={t("analytics.locationsSubdivision")}
          />
        </div>
        {q.isLoading ? (
          <Skeleton lines={4} />
        ) : !rows.length ? (
          <EmptyState compact title={t("analytics.servicesEmpty")} />
        ) : (
          <div className="main-scrollbar overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="sticky left-0 z-10 bg-surface px-3 py-2.5">{t("analytics.colBranch")}</th>
                  <th className="px-3 py-2.5 text-right">{t("analytics.colRevenue")}</th>
                  <th className="px-3 py-2.5 text-right">{t("analytics.colServices")}</th>
                  <th className="px-3 py-2.5 text-right">{t("analytics.colGoods")}</th>
                  <th className="px-3 py-2.5 text-right">{t("analytics.colAvgCheck")}</th>
                  <th className="px-3 py-2.5 text-right">{t("analytics.colOccupancy")}</th>
                  <th className="px-3 py-2.5 text-right">{t("analytics.colNewClients")}</th>
                  <th className="px-3 py-2.5 text-right">{t("analytics.colNotNewClients")}</th>
                  <th className="px-3 py-2.5 text-right">{t("analytics.colTotalBookings")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.businessId} className="border-b border-border last:border-0">
                    <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium text-fg">{r.businessName}</td>
                    <td className="px-3 py-2 text-right">{format.money(r.revenue)}</td>
                    <td className="px-3 py-2 text-right">{format.money(r.servicesRevenue)}</td>
                    <td className="px-3 py-2 text-right">{format.money(r.goodsRevenue)}</td>
                    <td className="px-3 py-2 text-right">{format.money(r.avgCheck)}</td>
                    <td className="px-3 py-2 text-right">{r.occupancy}%</td>
                    <td className="px-3 py-2 text-right">{r.newClients}</td>
                    <td className="px-3 py-2 text-right">{r.notNewClients}</td>
                    <td className="px-3 py-2 text-right">{r.totalBookings}</td>
                  </tr>
                ))}
                <tr className="font-semibold text-fg">
                  <td className="sticky left-0 z-10 bg-surface px-3 py-2">{t("analytics.total")}</td>
                  <td className="px-3 py-2 text-right">{format.money(totals.revenue)}</td>
                  <td className="px-3 py-2 text-right">{format.money(totals.servicesRevenue)}</td>
                  <td className="px-3 py-2 text-right">{format.money(totals.goodsRevenue)}</td>
                  <td className="px-3 py-2 text-right">—</td>
                  <td className="px-3 py-2 text-right">—</td>
                  <td className="px-3 py-2 text-right">{totals.newClients}</td>
                  <td className="px-3 py-2 text-right">{totals.notNewClients}</td>
                  <td className="px-3 py-2 text-right">{totals.totalBookings}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export function DailyDetailTab({ networkId, from, to }: { networkId: Id; from: ISODate; to: ISODate }) {
  const t = useT("network");
  const format = useFormat();
  const q = useApiQuery(["network", "dailyDetail", networkId, from, to], () => getNetworkDailyDetail(networkId, from, to));
  const runExport = useExport(networkId, "records");
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];
  return (
    <div data-f="F-12-094">
    <SectionCard title={t("analytics.tabs.daily")} actions={<ExportButton onExport={() => runExport(rows.length)} />}>
      {q.isLoading ? (
        <Skeleton lines={4} />
      ) : !rows.length ? (
        <EmptyState compact title={t("analytics.dailyEmpty")} />
      ) : (
        <div className="main-scrollbar overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-3 py-2.5">{t("analytics.colDate")}</th>
                <th className="px-3 py-2.5">{t("analytics.colBranch")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colRevenue")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colServicesShare")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colGoodsShare")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colNewClients")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colTotalBookings")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.date}-${r.businessId}`} className="border-b border-border last:border-0">
                  {(i === 0 || rows[i - 1].date !== r.date) && (
                    <td className="px-3 py-2 font-medium text-fg" rowSpan={rows.filter((x) => x.date === r.date).length}>
                      {format.date(r.date)}
                    </td>
                  )}
                  <td className="px-3 py-2">{r.businessName}</td>
                  <td className="px-3 py-2 text-right">{format.money(r.revenue)}</td>
                  <td className="px-3 py-2 text-right">{r.servicesSharePct}%</td>
                  <td className="px-3 py-2 text-right">{r.goodsSharePct}%</td>
                  <td className="px-3 py-2 text-right">{r.newClients}</td>
                  <td className="px-3 py-2 text-right">{r.totalBookings}</td>
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

export function ParamsDetailTab({ networkId, from, to }: { networkId: Id; from: ISODate; to: ISODate }) {
  const t = useT("network");
  const [metric, setMetric] = useState<NetworkParamMetric>("revenueSold");
  const [groupBy, setGroupBy] = useState<"day" | "month" | "year">("day");
  const q = useApiQuery(
    ["network", "paramSeries", networkId, metric, groupBy, from, to],
    () => getNetworkParamSeries(networkId, metric, groupBy, from, to),
  );
  const runExport = useExport(networkId, "records");
  const rows = useMemo(() => q.data ?? [], [q.data]);
  const keys = useMemo(() => Array.from(new Set(rows.flatMap((r) => r.points.map((p) => p.key)))).sort(), [rows]);
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  return (
    <div data-f="F-12-095">
    <SectionCard title={t("analytics.tabs.params")} actions={<ExportButton onExport={() => runExport(rows.length)} />}>
      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          options={NETWORK_PARAM_METRICS.map((m) => ({ value: m, label: t(`analytics.metric.${m}` as const) }))}
          value={metric}
          onValueChange={(v) => setMetric(v as NetworkParamMetric)}
        />
        <SegmentedControl
          options={(["day", "month", "year"] as const).map((g) => ({ value: g, label: t(`analytics.groupBy.${g}` as const) }))}
          value={groupBy}
          onValueChange={(v) => setGroupBy(v as typeof groupBy)}
        />
      </div>
      {q.isLoading ? (
        <Skeleton lines={4} />
      ) : !rows.length || !keys.length ? (
        <EmptyState compact title={t("analytics.dailyEmpty")} />
      ) : (
        <div className="main-scrollbar overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="sticky left-0 z-10 bg-surface px-3 py-2.5">{t("analytics.colBranch")}</th>
                {keys.map((k) => (
                  <th key={k} className="px-3 py-2.5 text-right">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.businessId} className="border-b border-border last:border-0">
                  <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium text-fg">{r.businessName}</td>
                  {keys.map((k) => (
                    <td key={k} className="px-3 py-2 text-right">
                      {r.points.find((p) => p.key === k)?.value ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="font-semibold text-fg">
                <td className="sticky left-0 z-10 bg-surface px-3 py-2">{t("analytics.total")}</td>
                {keys.map((k) => (
                  <td key={k} className="px-3 py-2 text-right">
                    {rows.reduce((s, r) => s + (r.points.find((p) => p.key === k)?.value ?? 0), 0)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
    </div>
  );
}

export function PlanExecutionTab({ networkId }: { networkId: Id }) {
  const t = useT("network");
  const tr = useT("reports");
  const toast = useToast();
  const format = useFormat();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [kind, setKind] = useState<NetworkPlanKind>("revenue");
  const q = useApiQuery(["network", "planExecution", networkId, month, kind], () => getNetworkPlanExecution(networkId, month, kind));
  const scheduleQ = useApiQuery(["reports", "planEmailSchedule", networkId], () => getPlanEmailSchedule(networkId));
  const saveSchedule = useApiMutation((schedule: PlanEmailSchedule) => setPlanEmailSchedule(networkId, schedule));
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];
  const hasPlan = rows.some((r) => r.planAmount > 0);
  const onScheduleChange = async (schedule: PlanEmailSchedule) => {
    try {
      await saveSchedule.mutate(schedule);
      toast.success(tr("planEmail.saved"));
    } catch {
      toast.error(tr("planEmail.saveFailed"));
    }
  };
  return (
    <div data-f="F-12-096">
    <div data-f="F-12-081" className="mb-4 flex flex-wrap items-center gap-3">
      <span className="text-sm text-muted">{tr("planEmail.label")}</span>
      <Select
        aria-label={tr("planEmail.label")}
        value={scheduleQ.data ?? "none"}
        onValueChange={(v) => void onScheduleChange(v as PlanEmailSchedule)}
        disabled={scheduleQ.isLoading}
        className="w-48"
        options={(["none", "daily", "weekly", "monthly"] as const).map((v) => ({ value: v, label: tr(`planEmail.options.${v}` as never) }))}
      />
    </div>
    <SectionCard title={t("analytics.tabs.plan")}>
      <div className="mb-4 flex flex-wrap gap-3">
        <Select options={monthOptions()} value={month} onValueChange={setMonth} className="w-40" />
        <SegmentedControl
          options={KINDS.map((k) => ({ value: k, label: t(`analytics.kind.${k}` as const) }))}
          value={kind}
          onValueChange={(v) => setKind(v as NetworkPlanKind)}
        />
      </div>
      {q.isLoading ? (
        <Skeleton lines={4} />
      ) : !hasPlan ? (
        <EmptyState compact title={t("analytics.planEmpty")} />
      ) : (
        <div className="main-scrollbar overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-3 py-2.5">{t("analytics.colBranch")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colRevenue")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colPlan")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colPctPlan")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colDayPlan")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colDayFact")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colRemainingTotal")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colRemainingPerDay")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colUnderPerDay")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colForecast")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.businessId} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium text-fg">{r.businessName}</td>
                  <td className="px-3 py-2 text-right">{kind === "revenue" ? format.money(r.revenue) : r.revenue}</td>
                  <td className="px-3 py-2 text-right">{kind === "revenue" ? format.money(r.planAmount) : r.planAmount}</td>
                  <td className="px-3 py-2 text-right">{r.pctOfPlan}%</td>
                  <td className="px-3 py-2 text-right">{kind === "revenue" ? format.money(r.dayPlan) : r.dayPlan}</td>
                  <td className="px-3 py-2 text-right">{kind === "revenue" ? format.money(r.avgDailyRevenue) : r.avgDailyRevenue}</td>
                  <td className={`px-3 py-2 text-right ${r.remainingTotal < 0 ? "text-danger" : ""}`}>
                    {kind === "revenue" ? format.money(r.remainingTotal) : r.remainingTotal}
                  </td>
                  <td className="px-3 py-2 text-right">{kind === "revenue" ? format.money(r.remainingPerDay) : r.remainingPerDay}</td>
                  <td className={`px-3 py-2 text-right ${r.underPerDay < 0 ? "text-danger" : ""}`}>
                    {kind === "revenue" ? format.money(r.underPerDay) : r.underPerDay}
                  </td>
                  <td className="px-3 py-2 text-right">{kind === "revenue" ? format.money(r.forecast) : r.forecast}</td>
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

export function ServicesReportTab({ networkId, from, to }: { networkId: Id; from: ISODate; to: ISODate }) {
  const t = useT("network");
  const format = useFormat();
  const q = useApiQuery(["network", "servicesReport", networkId, from, to], () => getNetworkServicesReport(networkId, from, to));
  const runExport = useExport(networkId, "records");
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];
  return (
    <div data-f="F-12-097">
    <SectionCard title={t("analytics.tabs.services")} actions={<ExportButton onExport={() => runExport(rows.length)} />}>
      {q.isLoading ? (
        <Skeleton lines={4} />
      ) : !rows.length ? (
        <EmptyState compact title={t("analytics.servicesEmpty")} />
      ) : (
        <div className="main-scrollbar overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-3 py-2.5">{t("analytics.colService")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colCount")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colRevenue")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colAvgPrice")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colPctRevenue")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.serviceId} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium text-fg">{r.name}</td>
                  <td className="px-3 py-2 text-right">{r.count}</td>
                  <td className="px-3 py-2 text-right">{format.money(r.revenue)}</td>
                  <td className="px-3 py-2 text-right">{format.money(r.avgPrice)}</td>
                  <td className="px-3 py-2 text-right">{r.pctOfRevenue}%</td>
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

export function StaffReportTab({ networkId, from, to }: { networkId: Id; from: ISODate; to: ISODate }) {
  const t = useT("network");
  const format = useFormat();
  const q = useApiQuery(["network", "staffReport", networkId, from, to], () => getNetworkStaffReport(networkId, from, to));
  const runExport = useExport(networkId, "staff");
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];
  return (
    <div data-f="F-12-098">
    <SectionCard title={t("analytics.tabs.staff")} actions={<ExportButton onExport={() => runExport(rows.length)} />}>
      {q.isLoading ? (
        <Skeleton lines={4} />
      ) : !rows.length ? (
        <EmptyState compact title={t("analytics.staffEmpty")} />
      ) : (
        <div className="main-scrollbar overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-3 py-2.5">{t("analytics.colStaff")}</th>
                <th className="px-3 py-2.5">{t("analytics.colPosition")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colRevenue")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colClients")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colHours")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colHourCost")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colPctRevenue")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.staffId} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium text-fg">{r.name}</td>
                  <td className="px-3 py-2">{r.position}</td>
                  <td className="px-3 py-2 text-right">{format.money(r.revenue)}</td>
                  <td className="px-3 py-2 text-right">{r.clientsCount}</td>
                  <td className="px-3 py-2 text-right">{r.hoursWorked}</td>
                  <td className="px-3 py-2 text-right">{format.money(r.hourCost)}</td>
                  <td className="px-3 py-2 text-right">{r.pctOfRevenue}%</td>
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

export function HrReportTab({ networkId }: { networkId: Id }) {
  const t = useT("network");
  const format = useFormat();
  const [query, setQuery] = useState("");
  const [fired, setFired] = useState<"" | "fired" | "notFired">("");
  const q = useApiQuery(["network", "hrReport", networkId, query, fired], () =>
    getNetworkHrReport(networkId, { query: query || undefined, fired: fired || undefined }),
  );
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];
  return (
    <div data-f="F-12-099 F-10-142">
    <SectionCard title={t("analytics.tabs.hr")}>
      <div className="mb-4 flex flex-wrap gap-3">
        <Input placeholder={t("analytics.hrSearch")} value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />
        <Select
          options={[
            { value: "", label: t("analytics.hrFiredAny") },
            { value: "fired", label: t("analytics.hrFiredOnly") },
            { value: "notFired", label: t("analytics.hrNotFired") },
          ]}
          value={fired}
          onValueChange={(v) => setFired(v as typeof fired)}
        />
      </div>
      {q.isLoading ? (
        <Skeleton lines={4} />
      ) : !rows.length ? (
        <EmptyState compact title={t("analytics.hrEmpty")} />
      ) : (
        <div className="main-scrollbar overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-3 py-2.5">{t("analytics.colStaff")}</th>
                <th className="px-3 py-2.5">{t("analytics.colBranch")}</th>
                <th className="px-3 py-2.5">{t("analytics.colPosition")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colHired")}</th>
                <th className="px-3 py-2.5 text-right">{t("analytics.colFired")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.staffId} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium text-fg">{r.name}</td>
                  <td className="px-3 py-2">{r.businessName}</td>
                  <td className="px-3 py-2">{r.position}</td>
                  <td className="px-3 py-2 text-right">{format.date(r.hiredAt)}</td>
                  <td className="px-3 py-2 text-right">{r.fired ? "✓" : "—"}</td>
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

export function AnalyticsSettingsTab({ networkId }: { networkId: Id }) {
  const t = useT("network");
  const toast = useToast();
  const q = useApiQuery(["network", "analyticsSettings", networkId], () => getNetworkAnalyticsSettings(networkId));
  const mutation = useApiMutation((args: { networkId: Id; days: number }) => setNetworkLostClientDays(args.networkId, args.days));
  const [value, setValue] = useState("");

  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  const commit = async () => {
    const days = Number(value);
    if (!days) return;
    try {
      await mutation.mutate({ networkId, days });
      toast.success(t("analytics.settingsLostSaved"));
      void q.refetch();
    } catch {
      /* поле само подсветит ошибку через invalid — здесь достаточно не терять ввод */
    }
  };

  return (
    <SectionCard title={t("analytics.tabs.settings")}>
      {q.isLoading ? (
        <Skeleton lines={2} />
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm font-medium text-fg">
            {t("analytics.settingsLostDays")}
            <Input
              inputMode="numeric"
              className="w-32"
              defaultValue={String(q.data?.lostClientDays ?? 60)}
              onChange={(e) => setValue(e.target.value)}
              onBlur={commit}
            />
          </label>
          <p className="text-xs text-muted">{t("analytics.settingsLostHint")}</p>
        </div>
      )}
    </SectionCard>
  );
}
