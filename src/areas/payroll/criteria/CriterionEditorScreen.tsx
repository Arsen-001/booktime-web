"use client";

/**
 * /biz/payroll/criteria/[criterionId] — создание/правка критерия расчёта (F-09-052): период, что, для
 * кого, по чему, порог, скидки, для чего. Принадлежит разделу «payroll».
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { getCriterion, saveCriterion } from "@/api/payroll";
import { useCoreList } from "@/api/core";
import { useApiMutation, useApiQuery } from "@/api/request";
import {
  evaluateCriterion,
  type CriterionMetric,
  type CriterionPeriod,
  type CriterionScope,
  type PayrollCriterion,
} from "@/domain/payroll";
import { useCurrent } from "@/demo/hooks";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { pickText } from "@/lib/text";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { ErrorState } from "@/ui/ErrorState";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { MoneyInput } from "@/ui/MoneyInput";
import { PageHeader } from "@/ui/PageHeader";
import { SectionCard } from "@/ui/SectionCard";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { Skeleton } from "@/ui/Skeleton";
import { StickyActionBar } from "@/ui/StickyActionBar";
import { useToast } from "@/ui/Toast";
import { useUnsavedGuard } from "@/ui/hooks/useUnsavedGuard";
import { usePayrollAccess } from "@/areas/payroll/access";

export function CriterionEditorScreen({
  criterionId,
}: {
  criterionId: string;
}) {
  const t = useT("payroll");
  const format = useFormat();
  const toast = useToast();
  const router = useRouter();
  const locale = useLocale();
  const { businessId } = useCurrent();
  const access = usePayrollAccess();
  const categoriesQuery = useCoreList(
    "serviceCategories",
    { businessId },
    { enabled: Boolean(businessId) },
  );

  const q = useApiQuery(["payroll", "criterion", criterionId], () =>
    getCriterion(criterionId),
  );
  const [draft, setDraft] = useState<PayrollCriterion | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (loadedFor !== criterionId && !q.isLoading) {
    setLoadedFor(criterionId);
    setDraft(q.data ?? null);
  }
  const dirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(q.data ?? null);
  useUnsavedGuard(dirty);
  const save = useApiMutation(saveCriterion);

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

  const handleSave = async () => {
    try {
      const saved = await save.mutate(draft);
      setDraft(saved);
      toast.success(t("classic.criteria.saveSuccess"));
    } catch {
      toast.error(t("classic.criteria.saveError"));
    }
  };

  // F-09-052 живой пример: «> 500 000» срабатывает при 510 000, не срабатывает при 490 000
  const metOver = evaluateCriterion(draft, 510000);
  const metUnder = evaluateCriterion(draft, 490000);

  return (
    <div data-f="F-09-052" className="mx-auto w-full max-w-[760px] flex flex-col gap-4 pb-20">
      <PageHeader title={draft.name} back={{ href: "/biz/payroll/criteria" }} />
      <fieldset
        disabled={!access.schemesAccess}
        className="flex flex-col gap-4 border-0 p-0 m-0 min-w-0"
      >
        <SectionCard title={t("classic.criteria.nameLabel")}>
          <FormField label={t("classic.criteria.nameLabel")}>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </FormField>
        </SectionCard>

        <SectionCard title={t("classic.criteria.periodLabel")}>
          <SegmentedControl
            value={draft.period}
            onValueChange={(v) =>
              setDraft({ ...draft, period: v as CriterionPeriod })
            }
            options={[
              { value: "month", label: t("classic.criteria.period.month") },
              { value: "day", label: t("classic.criteria.period.day") },
            ]}
          />
        </SectionCard>

        <SectionCard title={t("classic.criteria.metricLabel")}>
          <SegmentedControl
            value={draft.metric}
            onValueChange={(v) =>
              setDraft({ ...draft, metric: v as CriterionMetric })
            }
            options={[
              {
                value: "turnover",
                label: t("classic.criteria.metric.turnover"),
              },
              { value: "profit", label: t("classic.criteria.metric.profit") },
              { value: "count", label: t("classic.criteria.metric.count") },
            ]}
          />
        </SectionCard>

        <SectionCard title={t("classic.criteria.scopeLabel")}>
          <SegmentedControl
            value={draft.scope}
            onValueChange={(v) =>
              setDraft({ ...draft, scope: v as CriterionScope })
            }
            options={[
              { value: "staff", label: t("classic.criteria.scope.staff") },
              {
                value: "location",
                label: t("classic.criteria.scope.location"),
              },
            ]}
          />
        </SectionCard>

        <SectionCard title={t("classic.criteria.byLabel")}>
          <div className="flex flex-col gap-2">
            <Checkbox
              checked={draft.byServices}
              onCheckedChange={(v) =>
                setDraft({ ...draft, byServices: Boolean(v) })
              }
              label={t("classic.criteria.byServices")}
            />
            <Checkbox
              checked={draft.byProducts}
              onCheckedChange={(v) =>
                setDraft({ ...draft, byProducts: Boolean(v) })
              }
              label={t("classic.criteria.byProducts")}
            />
          </div>
        </SectionCard>

        <SectionCard
          title={t("classic.criteria.thresholdLabel")}
          description={t("classic.criteria.thresholdHint")}
        >
          {draft.metric === "count" ? (
            <FormField label={t("classic.criteria.thresholdCountLabel")}>
              <Input
                type="number"
                min={0}
                value={draft.threshold}
                onChange={(e) =>
                  setDraft({ ...draft, threshold: Number(e.target.value) || 0 })
                }
              />
            </FormField>
          ) : (
            <FormField label={t("classic.criteria.thresholdMoneyLabel")}>
              <MoneyInput
                value={draft.threshold}
                onValueChange={(v) => setDraft({ ...draft, threshold: v ?? 0 })}
              />
            </FormField>
          )}
          <Checkbox
            checked={draft.includeDiscounts}
            onCheckedChange={(v) =>
              setDraft({ ...draft, includeDiscounts: Boolean(v) })
            }
            label={t("classic.criteria.includeDiscounts")}
          />
          <p data-f="F-09-052" className="text-sm text-muted">
            {t("classic.criteria.example", {
              threshold: format.money(draft.threshold),
              over: metOver
                ? t("classic.criteria.met")
                : t("classic.criteria.notMet"),
              under: metUnder
                ? t("classic.criteria.met")
                : t("classic.criteria.notMet"),
            })}
          </p>
        </SectionCard>

        {draft.metric === "count" && (
          <SectionCard
            title={t("classic.criteria.forWhatLabel")}
            description={t("classic.criteria.forWhatHint")}
          >
            <div className="flex flex-col gap-2">
              {(categoriesQuery.data ?? []).map((c) => {
                const checked = draft.countCategoryIds.includes(c.id);
                return (
                  <Checkbox
                    key={c.id}
                    checked={checked}
                    onCheckedChange={(v) =>
                      setDraft({
                        ...draft,
                        countCategoryIds: v
                          ? [...draft.countCategoryIds, c.id]
                          : draft.countCategoryIds.filter((id) => id !== c.id),
                      })
                    }
                    label={pickText(c.name, locale)}
                  />
                );
              })}
            </div>
          </SectionCard>
        )}
      </fieldset>

      {access.schemesAccess && (
        <StickyActionBar>
          <Button
            variant="ghost"
            onClick={() => router.push("/biz/payroll/criteria")}
          >
            {t("classic.criteria.back")}
          </Button>
          <Button
            loading={save.isPending}
            disabled={!dirty}
            onClick={handleSave}
          >
            {t("classic.criteria.save")}
          </Button>
        </StickyActionBar>
      )}
      {!access.schemesAccess && (
        <Badge tone="neutral">{t("access.deniedHint")}</Badge>
      )}
    </div>
  );
}
