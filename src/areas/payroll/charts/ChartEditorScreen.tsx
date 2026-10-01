"use client";

/**
 * /biz/payroll/charts/[chartId] — создание/правка схемы классической модели (F-09-054) и вкладка
 * «Сотрудники» — назначение схемы с датой начала (F-09-055, F-09-099). Принадлежит разделу «payroll».
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Users } from "lucide-react";
import {
  assignChartToStaff,
  getChart,
  listChartAssignments,
  listCriteria,
  listRules,
  removeChartAssignment,
  saveChart,
} from "@/api/payroll";
import { useCoreList } from "@/api/core";
import { useApiMutation, useApiQuery } from "@/api/request";
import type { PayrollChart, PayrollChartType } from "@/domain/payroll";
import { useCurrent } from "@/demo/hooks";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { today } from "@/lib/date";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { DatePicker } from "@/ui/DatePicker";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { FormField } from "@/ui/FormField";
import { IconButton } from "@/ui/IconButton";
import { Input } from "@/ui/Input";
import { PageHeader } from "@/ui/PageHeader";
import { SectionCard } from "@/ui/SectionCard";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { Select } from "@/ui/Select";
import { Skeleton } from "@/ui/Skeleton";
import { StickyActionBar } from "@/ui/StickyActionBar";
import { Tabs } from "@/ui/Tabs";
import { useToast } from "@/ui/Toast";
import { useUnsavedGuard } from "@/ui/hooks/useUnsavedGuard";
import { usePayrollAccess } from "@/areas/payroll/access";

export function ChartEditorScreen({ chartId }: { chartId: string }) {
  const t = useT("payroll");
  const toast = useToast();
  const router = useRouter();
  const { businessId } = useCurrent();
  const access = usePayrollAccess();
  const [tab, setTab] = useState<"setup" | "staff">("setup");

  const q = useApiQuery(["payroll", "chart", chartId], () => getChart(chartId));
  const rulesQ = useApiQuery(
    ["payroll", "rules", businessId],
    () => listRules(businessId!),
    { enabled: Boolean(businessId) },
  );
  const criteriaQ = useApiQuery(
    ["payroll", "criteria", businessId],
    () => listCriteria(businessId!),
    { enabled: Boolean(businessId) },
  );

  const [draft, setDraft] = useState<PayrollChart | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (loadedFor !== chartId && !q.isLoading) {
    setLoadedFor(chartId);
    setDraft(q.data ?? null);
  }
  const dirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(q.data ?? null);
  useUnsavedGuard(dirty);
  const save = useApiMutation(saveChart);

  if (q.isLoading)
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4" aria-busy>
        <Skeleton className="h-8 w-1/2" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rect" className="h-28" />
        ))}
      </div>
    );
  if (q.isError || !draft)
    return <ErrorState onRetry={() => void q.refetch()} />;

  const ruleOptions = (rulesQ.data ?? []).map((r) => ({
    value: r.id,
    label: r.name,
  }));
  const criterionOptions = (criteriaQ.data ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const handleSave = async () => {
    try {
      const saved = await save.mutate(draft);
      setDraft(saved);
      toast.success(t("classic.charts.saveSuccess"));
    } catch {
      toast.error(t("classic.charts.saveError"));
    }
  };

  const addPlanRow = () => {
    if (!criterionOptions[0] || !ruleOptions[0]) return;
    setDraft({
      ...draft,
      planRows: [
        ...draft.planRows,
        {
          criterionId: criterionOptions[0].value,
          ruleId: ruleOptions[0].value,
        },
      ],
    });
  };

  return (
    <div data-f="F-09-053 F-09-054" className="mx-auto w-full max-w-[760px] flex flex-col gap-4 pb-20">
      <PageHeader title={draft.name} back={{ href: "/biz/payroll/charts" }} />
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
        items={[
          { value: "setup", label: t("classic.charts.tabSetup") },
          { value: "staff", label: t("classic.charts.tabStaff") },
        ]}
      />

      {tab === "setup" ? (
        <fieldset
          disabled={!access.schemesAccess}
          className="flex flex-col gap-4 border-0 p-0 m-0 min-w-0"
        >
          <SectionCard title={t("classic.charts.nameLabel")}>
            <FormField label={t("classic.charts.nameLabel")}>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </FormField>
          </SectionCard>

          <SectionCard title={t("classic.charts.typeLabel")}>
            <SegmentedControl
              value={draft.type}
              onValueChange={(v) =>
                setDraft({ ...draft, type: v as PayrollChartType })
              }
              options={[
                { value: "standard", label: t("classic.charts.type.standard") },
                { value: "planned", label: t("classic.charts.type.planned") },
              ]}
            />
          </SectionCard>

          <SectionCard
            title={t("classic.charts.standardRuleLabel")}
            description={
              draft.type === "planned"
                ? t("classic.charts.standardRuleFallbackHint")
                : undefined
            }
          >
            <Select
              options={ruleOptions}
              value={draft.standardRuleId ?? ""}
              onValueChange={(v) =>
                setDraft({ ...draft, standardRuleId: v || undefined })
              }
              placeholder={t("classic.charts.standardRulePlaceholder")}
            />
          </SectionCard>

          {draft.type === "planned" && (
            <div data-f="F-09-056">
              <SectionCard
                title={t("classic.charts.planRowsLabel")}
                description={t("classic.charts.planRowsHint")}
                actions={
                  access.schemesAccess && (
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Plus aria-hidden />}
                      onClick={addPlanRow}
                      disabled={!criterionOptions.length || !ruleOptions.length}
                    >
                      {t("classic.charts.planRowAdd")}
                    </Button>
                  )
                }
              >
                {draft.planRows.length === 0 ? (
                  <p className="text-sm text-muted">
                    {t("classic.charts.planRowsEmpty")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {draft.planRows.map((row, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <span className="text-sm text-muted">{idx + 1}.</span>
                        <Select
                          className="min-w-[180px] flex-1"
                          options={criterionOptions}
                          value={row.criterionId}
                          onValueChange={(v) => {
                            const rows = [...draft.planRows];
                            rows[idx] = { ...rows[idx], criterionId: v };
                            setDraft({ ...draft, planRows: rows });
                          }}
                        />
                        <span className="text-sm text-muted">→</span>
                        <Select
                          className="min-w-[180px] flex-1"
                          options={ruleOptions}
                          value={row.ruleId}
                          onValueChange={(v) => {
                            const rows = [...draft.planRows];
                            rows[idx] = { ...rows[idx], ruleId: v };
                            setDraft({ ...draft, planRows: rows });
                          }}
                        />
                        <IconButton
                          icon={<Trash2 aria-hidden className="size-4" />}
                          label={t("classic.charts.planRowRemove")}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              planRows: draft.planRows.filter(
                                (_, i) => i !== idx,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          )}
        </fieldset>
      ) : (
        <ChartStaffTab chart={draft} businessId={businessId} />
      )}

      {tab === "setup" && access.schemesAccess && (
        <StickyActionBar>
          <Button
            variant="ghost"
            onClick={() => router.push("/biz/payroll/charts")}
          >
            {t("classic.charts.back")}
          </Button>
          <Button
            loading={save.isPending}
            disabled={!dirty}
            onClick={handleSave}
          >
            {t("classic.charts.save")}
          </Button>
        </StickyActionBar>
      )}
      {!access.schemesAccess && (
        <Badge tone="neutral">{t("access.deniedHint")}</Badge>
      )}
    </div>
  );
}

function ChartStaffTab({
  chart,
  businessId,
}: {
  chart: PayrollChart;
  businessId: string | undefined;
}) {
  const t = useT("payroll");
  const format = useFormat();
  const toast = useToast();
  const access = usePayrollAccess();
  const staffQuery = useCoreList(
    "staff",
    { businessId },
    { enabled: Boolean(businessId) },
  );
  const assignmentsQuery = useApiQuery(
    ["payroll", "chartAssignments", chart.id],
    () => listChartAssignments(chart.id),
  );
  const [staffId, setStaffId] = useState("");
  const [startDate, setStartDate] = useState<string>(today());
  const assignM = useApiMutation(
    (args: { staffId: string; startDate: string }) =>
      assignChartToStaff(chart.id, args.staffId, args.startDate),
  );
  const removeM = useApiMutation(removeChartAssignment);

  const staffOptions = (staffQuery.data ?? [])
    .filter((s) => s.status !== "fired")
    .map((s) => ({ value: s.id, label: s.name }));
  const staffName = (id: string) =>
    staffQuery.data?.find((s) => s.id === id)?.name ?? id;

  const handleAssign = async () => {
    if (!staffId) return;
    try {
      await assignM.mutate({ staffId, startDate });
      toast.success(t("classic.charts.assignSuccess"));
      setStaffId("");
      assignmentsQuery.refetch();
    } catch {
      toast.error(t("classic.charts.assignError"));
    }
  };

  return (
    <div data-f="F-09-055 F-09-099" className="flex flex-col gap-4">
      {access.schemesAccess && (
        <SectionCard title={t("classic.charts.assignTitle")}>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <FormField label={t("classic.charts.assignStaffLabel")}>
                <Select
                  options={staffOptions}
                  value={staffId}
                  onValueChange={setStaffId}
                  placeholder={t("classic.charts.assignStaffPlaceholder")}
                />
              </FormField>
            </div>
            <FormField label={t("classic.charts.assignDateLabel")}>
              <DatePicker
                value={startDate}
                onValueChange={(d) => setStartDate(d ?? today())}
              />
            </FormField>
            <Button
              loading={assignM.isPending}
              disabled={!staffId}
              onClick={handleAssign}
            >
              {t("classic.charts.assignAction")}
            </Button>
          </div>
          {/* F-09-099: условия хранятся с датой начала — смена схемы с 01.10 не меняет расчёт сентября,
              потому что computePeriod/computeStatement (историческая дата) читают resolveActiveChartAssignment
              на дату операции, а не на "сегодня" */}
          <p className="pt-2 text-xs text-muted">
            {t("classic.charts.assignDateHint")}
          </p>
        </SectionCard>
      )}

      {assignmentsQuery.isLoading ? (
        <Skeleton lines={3} />
      ) : !assignmentsQuery.data || assignmentsQuery.data.length === 0 ? (
        <EmptyState
          icon={<Users aria-hidden className="size-8 text-muted" />}
          title={t("classic.charts.assignEmpty")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {assignmentsQuery.data.map((a) => (
            <Card
              key={a.id}
              padding="sm"
              className="flex items-center justify-between gap-3"
            >
              <div>
                <p className="font-medium text-fg">{staffName(a.staffId)}</p>
                <p className="text-sm text-muted">
                  {t("classic.charts.assignSince", {
                    date: format.date(a.startDate),
                  })}
                </p>
              </div>
              {access.schemesAccess && (
                <IconButton
                  icon={<Trash2 aria-hidden className="size-4" />}
                  label={t("classic.charts.assignRemove")}
                  onClick={async () => {
                    await removeM.mutate(a.id);
                    assignmentsQuery.refetch();
                  }}
                />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
