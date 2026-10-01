"use client";

/**
 * /biz/payroll/setup — быстрая настройка схем всем мастерам за один проход (F-09-104), для подключения
 * салона на личном визите (⭐ F-00-176). Принадлежит разделу «payroll».
 */
import { useState } from "react";
import { CheckCircle2, Rocket } from "lucide-react";
import { bulkApplyDefaultScheme, listSetupTargets } from "@/api/payroll";
import { useApiMutation, useApiQuery } from "@/api/request";
import { usePayrollAccess } from "@/areas/payroll/access";
import { useCurrent } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Checkbox } from "@/ui/Checkbox";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { PageHeader } from "@/ui/PageHeader";
import { SectionCard } from "@/ui/SectionCard";
import { SkeletonText } from "@/ui/Skeleton";
import { StickyActionBar } from "@/ui/StickyActionBar";
import { useToast } from "@/ui/Toast";

export function SetupScreen() {
  const t = useT("payroll");
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const access = usePayrollAccess();
  const q = useApiQuery(
    ["payroll", "setupTargets", businessId],
    () => listSetupTargets(businessId!),
    { enabled: ready && Boolean(businessId) },
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [percent, setPercent] = useState(40);
  const applyM = useApiMutation(
    (args: { staffIds: string[]; percent: number }) =>
      bulkApplyDefaultScheme(args.staffIds, args.percent),
  );
  const [done, setDone] = useState<number | null>(null);

  if (!access.schemesAccess) {
    return (
      <div className="mx-auto w-full max-w-[760px] flex flex-col gap-6">
        <PageHeader title={t("setup.title")} />
        <EmptyState
          icon={<Rocket aria-hidden className="size-8 text-muted" />}
          title={t("access.deniedHint")}
        />
      </div>
    );
  }

  const unconfigured = (q.data ?? []).filter((r) => !r.hasScheme);
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(
      selected.size === unconfigured.length
        ? new Set()
        : new Set(unconfigured.map((r) => r.staff.id)),
    );

  const handleApply = async () => {
    const applied = await applyM.mutate({
      staffIds: Array.from(selected),
      percent,
    });
    setDone(applied);
    toast.success(t("setup.applied", { count: applied }));
    setSelected(new Set());
    q.refetch();
  };

  return (
    <div data-f="F-09-104" className="mx-auto w-full max-w-[760px] flex flex-col gap-6 pb-20">
      <PageHeader title={t("setup.title")} description={t("setup.subtitle")} />

      {q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : !q.isLoading && unconfigured.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 aria-hidden className="size-8 text-success" />}
          title={t("setup.allDone")}
        />
      ) : (
        <>
          <SectionCard
            title={t("setup.rateTitle")}
            description={t("setup.rateHint")}
          >
            <FormField label={t("setup.rateLabel")}>
              <Input
                type="number"
                min={0}
                max={100}
                value={percent}
                onChange={(e) =>
                  setPercent(
                    Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                  )
                }
                className="w-24"
                disabled={q.isLoading}
              />
            </FormField>
          </SectionCard>

          <div className="flex items-center justify-between">
            <Checkbox
              checked={!q.isLoading && selected.size === unconfigured.length}
              onCheckedChange={toggleAll}
              label={t("setup.selectAll")}
              disabled={q.isLoading}
            />
            <Badge tone="neutral">
              {t("setup.selectedCount", { count: selected.size })}
            </Badge>
          </div>

          <div className="flex flex-col gap-2">
            {/* Скелетон — те же карточки «галочка · имя» */}
            {q.isLoading &&
              ["16ch", "13ch", "18ch", "14ch"].map((w) => (
                <Card key={w} padding="sm" className="flex items-center gap-3">
                  <Checkbox checked={false} disabled label={<SkeletonText width={w} />} />
                </Card>
              ))}
            {unconfigured.map((r) => (
              <Card
                key={r.staff.id}
                padding="sm"
                className="flex items-center gap-3"
              >
                <Checkbox
                  checked={selected.has(r.staff.id)}
                  onCheckedChange={() => toggle(r.staff.id)}
                  label={r.staff.name}
                />
              </Card>
            ))}
          </div>

          <StickyActionBar>
            <span className="text-sm text-muted">
              {t("setup.selectedCount", { count: selected.size })}
            </span>
            <Button
              loading={applyM.isPending}
              disabled={selected.size === 0}
              onClick={handleApply}
            >
              {t("setup.apply")}
            </Button>
          </StickyActionBar>
        </>
      )}

      {done !== null && (
        <p className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 aria-hidden className="size-4" />{" "}
          {t("setup.applied", { count: done })}
        </p>
      )}
    </div>
  );
}
