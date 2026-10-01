"use client";

/**
 * /biz/payroll/rules/[ruleId] — создание/правка правила классической модели (F-09-050), плюс учёт
 * себестоимости услуги (F-09-027). Принадлежит разделу «payroll». Блоки — те же компоненты, что у
 * упрощённой схемы сотрудника (PayrollRule и PayrollScheme используют одни и те же типы блоков).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { getRule, listProductCatalog, saveRule } from "@/api/payroll";
import { useCoreList } from "@/api/core";
import { useApiMutation, useApiQuery } from "@/api/request";
import type { PayrollRule, ServiceCostOrder } from "@/domain/payroll";
import {
  packageServiceStaffBases,
  serviceCostBasisPayout,
} from "@/domain/payroll";
import { useCurrent } from "@/demo/hooks";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { pickText } from "@/lib/text";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { ErrorState } from "@/ui/ErrorState";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { PageHeader } from "@/ui/PageHeader";
import { SectionCard } from "@/ui/SectionCard";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { Skeleton } from "@/ui/Skeleton";
import { StickyActionBar } from "@/ui/StickyActionBar";
import { useToast } from "@/ui/Toast";
import { useUnsavedGuard } from "@/ui/hooks/useUnsavedGuard";
import { usePayrollAccess } from "@/areas/payroll/access";
import { BlockCard } from "@/areas/payroll/scheme/BlockCard";
import type { OverrideTargetOption } from "@/areas/payroll/scheme/OverridesEditor";
import { ExtraRevenueBlockCard } from "@/areas/payroll/scheme/blocks/ExtraRevenueBlock";
import { PersonalServicesBlockCard } from "@/areas/payroll/scheme/blocks/PersonalServicesBlock";
import { ProductSalesBlockCard } from "@/areas/payroll/scheme/blocks/ProductSalesBlock";
import { RecordsBlockCard } from "@/areas/payroll/scheme/blocks/RecordsBlock";
import { WorkdayBlockCard } from "@/areas/payroll/scheme/blocks/WorkdayBlock";

export function RuleEditorScreen({ ruleId }: { ruleId: string }) {
  const t = useT("payroll");
  const format = useFormat();
  const toast = useToast();
  const router = useRouter();
  const locale = useLocale();
  const { businessId } = useCurrent();
  const access = usePayrollAccess();

  const ruleQ = useApiQuery(["payroll", "rule", ruleId], () => getRule(ruleId));
  const servicesQuery = useCoreList(
    "services",
    { businessId },
    { enabled: Boolean(businessId) },
  );
  const categoriesQuery = useCoreList(
    "serviceCategories",
    { businessId },
    { enabled: Boolean(businessId) },
  );
  const productsQuery = useApiQuery(["payroll", "products"], () =>
    listProductCatalog(),
  );

  const [draft, setDraft] = useState<PayrollRule | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (loadedFor !== ruleId && !ruleQ.isLoading) {
    setLoadedFor(ruleId);
    setDraft(ruleQ.data ?? null);
  }
  const dirty =
    draft !== null &&
    JSON.stringify(draft) !== JSON.stringify(ruleQ.data ?? null);
  useUnsavedGuard(dirty);
  const save = useApiMutation(saveRule);

  if (ruleQ.isLoading)
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4" aria-busy>
        <Skeleton className="h-8 w-1/2" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rect" className="h-28" />
        ))}
      </div>
    );
  if (ruleQ.isError || !draft)
    return <ErrorState onRetry={() => void ruleQ.refetch()} />;

  const serviceTargets: OverrideTargetOption[] = [
    ...(categoriesQuery.data ?? []).map((c) => ({
      id: c.id,
      label: pickText(c.name, locale),
      type: "category" as const,
    })),
    ...(servicesQuery.data ?? []).map((s) => ({
      id: s.id,
      label: pickText(s.name, locale),
      type: "item" as const,
    })),
  ];
  const productTargets: OverrideTargetOption[] = [
    {
      id: "kind:subscription",
      label: t("scheme.blocks.productSales.kindSubscription"),
      type: "category" as const,
    },
    {
      id: "kind:certificate",
      label: t("scheme.blocks.productSales.kindCertificate"),
      type: "category" as const,
    },
    ...(productsQuery.data ?? [])
      .filter((p) => p.kind === "product")
      .map((p) => ({ id: p.id, label: p.name, type: "item" as const })),
  ];

  const handleSave = async () => {
    try {
      const saved = await save.mutate(draft);
      setDraft(saved);
      toast.success(t("classic.rules.saveSuccess"));
    } catch {
      toast.error(t("classic.rules.saveError"));
    }
  };

  // F-09-027 живой пример: цена 1000, себестоимость 300, ставка из блока услуг → показываем обоими порядками
  const examplePrice = 1000;
  const exampleCost = 300;
  const rate = draft.personalServices.defaultPayout;
  const exampleDiscountFirst = serviceCostBasisPayout(
    examplePrice,
    10,
    exampleCost,
    { enabled: true, order: "discountFirst" },
    rate,
  );
  const exampleCostFirst = serviceCostBasisPayout(
    examplePrice,
    10,
    exampleCost,
    { enabled: true, order: "costFirst" },
    rate,
  );

  // F-09-108: пакетная услуга «4 руки» — база каждого мастера при способе «Суммировать из услуг»
  // (по умолчанию, 119203): 2 000 + 1 500 → каждый получает базу своей услуги без изменений.
  const packageExampleBases = packageServiceStaffBases(
    [
      { id: "manicure", staffId: "master-1", price: 2000 },
      { id: "pedicure", staffId: "master-2", price: 1500 },
    ],
    "sumServices",
  );

  return (
    <div data-f="F-09-050 F-09-027" className="mx-auto w-full max-w-[760px] flex flex-col gap-4 pb-20">
      <PageHeader
        title={draft.name}
        description={t("classic.rules.editSubtitle")}
        back={{ href: "/biz/payroll/rules" }}
      />
      <fieldset
        disabled={!access.schemesAccess}
        className="flex flex-col gap-4 border-0 p-0 m-0 min-w-0"
      >
        <SectionCard title={t("classic.rules.nameLabel")}>
          <FormField label={t("classic.rules.nameLabel")}>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </FormField>
        </SectionCard>

        <PersonalServicesBlockCard
          value={draft.personalServices}
          onChange={(personalServices) =>
            setDraft({ ...draft, personalServices })
          }
          targets={serviceTargets}
          assistCompensationEnabled={false}
        />

        <BlockCard
          dataF="F-09-027"
          title={t("classic.rules.costBasis.title")}
          description={t("classic.rules.costBasis.description")}
          enabled={draft.serviceCostBasis.enabled}
          onEnabledChange={(enabled) =>
            setDraft({
              ...draft,
              serviceCostBasis: { ...draft.serviceCostBasis, enabled },
            })
          }
        >
          <SegmentedControl
            value={draft.serviceCostBasis.order}
            onValueChange={(order) =>
              setDraft({
                ...draft,
                serviceCostBasis: {
                  ...draft.serviceCostBasis,
                  order: order as ServiceCostOrder,
                },
              })
            }
            options={[
              {
                value: "discountFirst",
                label: t("classic.rules.costBasis.discountFirst"),
              },
              {
                value: "costFirst",
                label: t("classic.rules.costBasis.costFirst"),
              },
            ]}
          />
          <p className="text-sm text-muted">
            {t("classic.rules.costBasis.example", {
              discountFirst: format.money(exampleDiscountFirst),
              costFirst: format.money(exampleCostFirst),
            })}
          </p>
        </BlockCard>

        <ProductSalesBlockCard
          value={draft.productSales}
          onChange={(productSales) => setDraft({ ...draft, productSales })}
          targets={productTargets}
        />
        <WorkdayBlockCard
          value={draft.workday}
          onChange={(workday) => setDraft({ ...draft, workday })}
        />
        <RecordsBlockCard
          value={draft.records}
          onChange={(records) => setDraft({ ...draft, records })}
          targets={[]}
        />
        <ExtraRevenueBlockCard
          kind="services"
          value={draft.extraServiceRevenue}
          onChange={(extraServiceRevenue) =>
            setDraft({ ...draft, extraServiceRevenue })
          }
        />
        <ExtraRevenueBlockCard
          kind="products"
          value={draft.extraProductRevenue}
          onChange={(extraProductRevenue) =>
            setDraft({ ...draft, extraProductRevenue })
          }
        />

        <SectionCard
          title={t("classic.rules.packageTitle")}
          description={t("classic.rules.packageDescription")}
        >
          <div data-f="F-09-108" className="flex flex-col gap-2 text-sm">
            {packageExampleBases.map((b) => (
              <div
                key={b.serviceId}
                className="flex items-center justify-between"
              >
                <span className="text-muted">{b.serviceId}</span>
                <span className="font-medium tabular-nums text-fg">
                  {format.money(b.base)}
                </span>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted">
              {t("classic.rules.packageHint")}
            </p>
          </div>
        </SectionCard>
      </fieldset>

      {access.schemesAccess && (
        <StickyActionBar>
          <Button
            variant="ghost"
            onClick={() => router.push("/biz/payroll/rules")}
          >
            {t("classic.rules.back")}
          </Button>
          <Button
            loading={save.isPending}
            disabled={!dirty}
            onClick={handleSave}
          >
            {t("classic.rules.save")}
          </Button>
        </StickyActionBar>
      )}
      {!access.schemesAccess && (
        <Badge tone="neutral">{t("access.deniedHint")}</Badge>
      )}
    </div>
  );
}
