"use client";

/**
 * /biz/network/staff/payroll — расчёт зарплат сети (F-11-109): период, филиалы, «Создать ведомость и начислить».
 * F-09-096 (payroll, точечная правка по CONVENTIONS §1 «второй проход», qa/requests/payroll.md 2026-09-26):
 * «Создать ведомость и начислить» теперь реально создаёт и начисляет по ведомости на каждого сотрудника
 * каждой выбранной локации (createNetworkPayrollRun → finance's createSettlementSheet в цикле по businessIds,
 * src/api/network.ts) — раньше только фиксировала факт запуска.
 */
import { useState } from "react";
import { CircleDollarSign } from "lucide-react";
import {
  createNetworkPayrollRun,
  listNetworkLocations,
  listNetworkPayrollRuns,
} from "@/api/network";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { today, addDays, datePart } from "@/lib/date";
import { Button, LinkButton } from "@/ui/Button";
import { DatePicker } from "@/ui/DatePicker";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { FormField } from "@/ui/FormField";
import { PageHeader } from "@/ui/PageHeader";
import { usePagedList } from "@/ui/Pagination";
import { SectionCard } from "@/ui/SectionCard";
import { Skeleton } from "@/ui/Skeleton";
import { useToast } from "@/ui/Toast";
import { LocationsPicker } from "@/areas/network/lib/LocationsPicker";
import { useNetwork } from "@/areas/network/lib/useNetwork";

export function PayrollScreen() {
  const t = useT("network");
  const toast = useToast();
  const format = useFormat();
  const { ready, networkId, isError, refetch } = useNetwork();
  const locationsQ = useApiQuery(
    ["network", "locations", networkId],
    () => listNetworkLocations(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const runsQ = useApiQuery(
    ["network", "payrollRuns", networkId],
    () => listNetworkPayrollRuns(networkId!),
    { enabled: ready && Boolean(networkId) },
  );

  const todayDate = datePart(today());
  const [from, setFrom] = useState(addDays(todayDate, -30));
  const [to, setTo] = useState(todayDate);
  const [businessIds, setBusinessIds] = useState<string[]>([]);

  const mutation = useApiMutation((_: void) =>
    createNetworkPayrollRun(networkId!, {
      from,
      to,
      businessIds,
      authorName: "",
    }),
  );

  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: runsPage, pager: runsPager } = usePagedList(runsQ.data ?? []);

  if (isError || runsQ.isError)
    return <ErrorState onRetry={() => (isError ? refetch() : runsQ.refetch())} />;

  const run = async () => {
    if (!businessIds.length) {
      toast.error(t("services.form.locationsRequired"));
      return;
    }
    try {
      await mutation.mutate();
      toast.success(t("staff.payroll.created"));
      runsQ.refetch();
    } catch {
      toast.error(t("staff.payroll.createFailed"));
    }
  };

  return (
    <div
      data-f="F-11-109 F-09-096"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
    >
      <PageHeader title={t("staff.payroll.title")} description={t("staff.payroll.subtitle")} />
      <LinkButton href="/biz/network/staff" variant="ghost" size="sm" className="w-fit">
        ← {t("staff.title")}
      </LinkButton>

      <SectionCard title={t("staff.payroll.periodLabel")}>
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <FormField label={t("staff.payroll.periodFrom")} className="flex-1">
              <DatePicker value={from} onValueChange={(v) => v && setFrom(v)} />
            </FormField>
            <FormField label={t("staff.payroll.periodTo")} className="flex-1">
              <DatePicker value={to} onValueChange={(v) => v && setTo(v)} />
            </FormField>
          </div>
          <FormField label={t("staff.payroll.locationsTitle")}>
            <LocationsPicker
              locations={locationsQ.data ?? []}
              value={businessIds}
              onChange={setBusinessIds}
            />
          </FormField>
          <Button loading={mutation.isPending} onClick={run}>
            {t("staff.payroll.createButton")}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title={t("staff.payroll.historyTitle")}>
        {!ready || runsQ.isLoading ? (
          <Skeleton lines={3} />
        ) : !runsQ.data?.length ? (
          <EmptyState compact icon={<CircleDollarSign aria-hidden />} title={t("staff.payroll.empty")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {runsPage.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <span className="text-sm text-fg">
                  {t("staff.payroll.period", {
                    from: format.date(r.period.from),
                    to: format.date(r.period.to),
                  })}
                </span>
                <span className="text-xs text-muted">
                  {t("staff.payroll.staffCount", { count: r.staffCount })}
                </span>
              </li>
            ))}
          </ul>
        )}
        {runsPager && <div className="mt-4">{runsPager}</div>}
      </SectionCard>
    </div>
  );
}
