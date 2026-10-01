"use client";

/**
 * Экран схемы сотрудника: шесть блоков, копирование, сохранение (F-09-010…013, F-09-014, F-09-016,
 * F-09-031, F-09-032, F-09-036, F-09-039, F-09-042, F-09-043). Принадлежит разделу «payroll».
 * Используется и на /biz/payroll/staff/[staffId], и во вкладке карточки сотрудника (extensions/StaffCard).
 *
 * Зарплата-ревью 27.09: проверка ставок до сохранения, кнопка неактивна, «показать» прокручивает к ошибке (З4);
 * «Действует с» и история версий — правка ставки не пересчитывает прошлое (З6); шаблоны и «Применить к…» (З12);
 * «Отменить изменения» (З13).
 */
import { useRef, useState } from "react";
import { useLocale } from "next-intl";
import { History, LayoutTemplate, Undo2, UsersRound } from "lucide-react";
import type { Id } from "@/domain/core";
import {
  emptyScheme,
  isSchemeBlank,
  SCHEME_TEMPLATE_IDS,
  schemeBlocksEqual,
  schemeVersions,
  summarizeScheme,
  validateScheme,
  type PayrollScheme,
  type SchemeTemplateId,
} from "@/domain/payroll";
import {
  createSchemeFromTemplate,
  getGeneralSettings,
  getScheme,
  listProductCatalog,
  listStaffSchemeStatus,
  saveScheme,
} from "@/api/payroll";
import { useCoreGet, useCoreList } from "@/api/core";
import { ApiError, useApiMutation, useApiQuery } from "@/api/request";
import { dayjs, nowDateTime, today } from "@/lib/date";
import { pickText } from "@/lib/text";
import { useCurrent } from "@/demo/hooks";
import { usePayrollAccess } from "@/areas/payroll/access";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { useToast } from "@/ui/Toast";
import { useUnsavedGuard } from "@/ui/hooks/useUnsavedGuard";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { DatePicker } from "@/ui/DatePicker";
import { DropdownMenu } from "@/ui/DropdownMenu";
import { ErrorState } from "@/ui/ErrorState";
import { FormField } from "@/ui/FormField";
import { Skeleton, SkeletonText } from "@/ui/Skeleton";
import { StickyActionBar } from "@/ui/StickyActionBar";
import { ApplySchemeDialog } from "@/areas/payroll/scheme/ApplySchemeDialog";
import { CopySchemeDialog } from "@/areas/payroll/scheme/CopySchemeDialog";
import { SchemePromo } from "@/areas/payroll/scheme/SchemePromo";
import { ExtraRevenueBlockCard } from "@/areas/payroll/scheme/blocks/ExtraRevenueBlock";
import { PersonalServicesBlockCard } from "@/areas/payroll/scheme/blocks/PersonalServicesBlock";
import { ProductSalesBlockCard } from "@/areas/payroll/scheme/blocks/ProductSalesBlock";
import { RecordsBlockCard } from "@/areas/payroll/scheme/blocks/RecordsBlock";
import { WorkdayBlockCard } from "@/areas/payroll/scheme/blocks/WorkdayBlock";
import type { OverrideTargetOption } from "@/areas/payroll/scheme/OverridesEditor";

export interface SchemeEditorProps {
  staffId: Id;
  businessId: Id;
  /** Внутри карточки сотрудника — компактнее, без своего заголовка страницы */
  embedded?: boolean;
}

/**
 * Скелет в форме редактора: та же строка подсказки с кнопками, та же карточка «Действует с», затем блоки схемы.
 * Статичное (подписи, кнопки) — настоящее и неактивное; меняются только значения.
 */
function SchemeEditorSkeleton({ canManage, embedded }: { canManage: boolean; embedded: boolean }) {
  const t = useT("payroll");
  return (
    <div className="flex flex-col gap-4" aria-busy>
      {!embedded && (
        <p className="text-base font-medium text-fg">
          <SkeletonText width="40ch" />
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {canManage ? t("scheme.hint") : t("scheme.readOnlyHint")}
        </p>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" leftIcon={<LayoutTemplate aria-hidden className="size-4" />} disabled>
              {t("scheme.templates.action")}
            </Button>
            <Button variant="outline" size="sm" disabled>
              {t("scheme.copy.action")}
            </Button>
            <Button variant="outline" size="sm" leftIcon={<UsersRound aria-hidden className="size-4" />} disabled>
              {t("scheme.applyTo.action")}
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <FormField label={t("scheme.effectiveFrom")} hint={t("scheme.effectiveFromHint")}>
          <DatePicker value={null} onValueChange={() => {}} disabled className="sm:max-w-60" />
        </FormField>
      </div>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} variant="rect" className="h-28" />
      ))}
    </div>
  );
}

export function SchemeEditor({
  staffId,
  businessId,
  embedded = false,
}: SchemeEditorProps) {
  const t = useT("payroll");
  const format = useFormat();
  const toast = useToast();
  const locale = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  // F-09-085/089: право «Доступ к схемам расчёта» — владелец/сеть всегда полный доступ, остальные —
  // только если владелец включил schemesAccess этому сотруднику (resolvePayrollAccess в api/payroll.ts)
  const access = usePayrollAccess();
  const canManage = access.schemesAccess;
  const { locationId: currentLocationId, activeLocationIds } = useCurrent();
  const locationId =
    currentLocationId === "all" ? activeLocationIds[0] : currentLocationId;

  const staffQuery = useCoreGet("staff", staffId);
  const schemeQuery = useApiQuery(["payroll", "scheme", staffId], () =>
    getScheme(staffId),
  );
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
  // F-09-008: три ставки ассистирования (F-09-015) видны только когда локация это включила
  const generalSettingsQuery = useApiQuery(
    ["payroll", "settings", locationId],
    () => getGeneralSettings(locationId!),
    {
      enabled: Boolean(locationId),
    },
  );
  const closedThrough = generalSettingsQuery.data?.closedThrough;
  const minEffective = closedThrough
    ? dayjs(closedThrough).add(1, "day").format("YYYY-MM-DD")
    : undefined;
  const candidatesQuery = useApiQuery(
    ["payroll", "schemesList", businessId],
    () => listStaffSchemeStatus(businessId),
    {
      enabled: Boolean(businessId),
    },
  );

  const [draft, setDraft] = useState<PayrollScheme | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  // З6: дату «Действует с» трогали руками — больше не подставляем «сегодня» сами
  const [fromTouched, setFromTouched] = useState(false);
  // Подхват сохранённой схемы в черновик по id сотрудника (F-09-013) — правка состояния при рендере
  // (не в эффекте, §18 п. 6): сбрасываем черновик, когда открыли другого сотрудника
  const [loadedFor, setLoadedFor] = useState<Id | null>(null);
  if (loadedFor !== staffId && !schemeQuery.isLoading) {
    setLoadedFor(staffId);
    setDraft(schemeQuery.data ?? null);
    setFromTouched(false);
  }

  const saved = schemeQuery.data;
  const dirty =
    draft !== null &&
    JSON.stringify(draft) !== JSON.stringify(saved ?? null);
  useUnsavedGuard(dirty);

  const save = useApiMutation(saveScheme);

  if (staffQuery.isLoading || schemeQuery.isLoading)
    return <SchemeEditorSkeleton canManage={canManage} embedded={embedded} />;
  if (staffQuery.isError || schemeQuery.isError || !staffQuery.data) {
    return (
      <ErrorState
        onRetry={() => {
          void staffQuery.refetch();
          void schemeQuery.refetch();
        }}
      />
    );
  }

  if (!draft) {
    return (
      <SchemePromo
        compact={embedded}
        onConfigure={() =>
          setDraft({ ...emptyScheme(staffId, nowDateTime()), effectiveFrom: minEffective && minEffective > today() ? minEffective : undefined })
        }
      />
    );
  }

  /**
   * З6: правка блоков сохранённой схемы по умолчанию начинает НОВУЮ версию с сегодняшнего дня (или с первого
   * дня после закрытого периода) — прошлые визиты остаются по прежним ставкам.
   */
  const update = (next: PayrollScheme) => {
    if (saved && !fromTouched && !schemeBlocksEqual(saved, next)) {
      const start = minEffective && minEffective > today() ? minEffective : today();
      if ((saved.effectiveFrom ?? "") < start) next = { ...next, effectiveFrom: start };
    } else if (saved && !fromTouched && schemeBlocksEqual(saved, next)) {
      next = { ...next, effectiveFrom: saved.effectiveFrom };
    }
    setDraft(next);
  };

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
  // F-09-105: два синтетических «категории» поверх обычных товаров — своё значение для всех
  // абонементов/сертификатов сразу (см. domain/payroll.ts pseudoCategoryForGoodsKind)
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

  // З4: те же проверки, что у api (saveScheme), — кнопка неактивна, пока есть ошибки
  const issues = validateScheme(draft);
  const showFirstIssue = () => {
    const el = rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
  };

  async function handleSave() {
    if (!draft || issues.length > 0) return;
    try {
      const result = await save.mutate(draft);
      setDraft(result);
      setFromTouched(false);
      toast.success(t("scheme.saveSuccess"));
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "";
      toast.error(
        code === "scheme_overlap"
          ? t("scheme.saveErrorOverlap")
          : code === "scheme_closed"
            ? t("scheme.saveErrorClosed")
            : code === "validation"
              ? t("scheme.saveErrorValidation")
              : t("scheme.saveError"),
      );
    }
  }

  const handleReset = () => {
    setDraft(saved ?? null);
    setFromTouched(false);
    toast.info(t("scheme.reset_done"));
  };

  const applyTemplate = (id: SchemeTemplateId) => {
    const tpl = createSchemeFromTemplate(id, staffId);
    update({
      ...tpl,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      effectiveFrom: draft.effectiveFrom,
      history: draft.history,
    });
  };

  // F-09-011: фраза-итог сверху вместо стены тумблеров — приём соперника (qa/measure/payroll/
  // ux-best-c1.md §1, ux-best-c2.md §2): что включено, видно одной строкой, не читая шесть блоков.
  const payoutText = (v: { unit: "percent" | "amount"; value: number }) =>
    v.unit === "percent" ? `${v.value}%` : format.money(v.value);
  const summaryParts = summarizeScheme(draft).map((fact) => {
    switch (fact.kind) {
      case "personalServices":
        return t("scheme.summary.personalServices", {
          value: payoutText(fact.payout!),
        });
      case "productSales":
        return t("scheme.summary.productSales", {
          value: payoutText(fact.payout!),
        });
      case "records":
        return t("scheme.summary.records", { value: payoutText(fact.payout!) });
      case "workday":
        return t(`scheme.summary.workday.${fact.workdayPeriod!}`, {
          amount: format.money(fact.workdayAmount!),
        });
      case "guaranteedMin":
        return t(`scheme.summary.guaranteedMin.${fact.guaranteedMin!.period}`, {
          amount: format.money(fact.guaranteedMin!.amount),
        });
    }
  });
  const isBlank = isSchemeBlank(draft) && Boolean(saved);
  const versions = saved ? schemeVersions(saved) : [];

  return (
    <div ref={rootRef} data-f="F-09-011 F-09-013 F-09-082" className="flex flex-col gap-4">
      {!embedded && isBlank && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{t("scheme.blankBadge")}</Badge>
          <p className="text-sm text-muted">{t("scheme.summary.blankHint")}</p>
        </div>
      )}
      {!embedded && !isBlank && summaryParts.length > 0 && (
        <p data-f="F-09-011" className="text-base font-medium text-fg">
          {t("scheme.summary.prefix", { name: staffQuery.data.name })}{" "}
          {summaryParts.join(" · ")}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {canManage ? t("scheme.hint") : t("scheme.readOnlyHint")}
        </p>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <DropdownMenu
              label={t("scheme.templates.title")}
              align="end"
              trigger={(p) => (
                <Button {...p} variant="outline" size="sm" leftIcon={<LayoutTemplate aria-hidden className="size-4" />}>
                  {t("scheme.templates.action")}
                </Button>
              )}
              items={[
                { id: "tpl-label", groupLabel: t("scheme.templates.description") },
                ...SCHEME_TEMPLATE_IDS.map((id) => ({
                  id,
                  label: t(`scheme.templates.${id}`),
                  onSelect: () => applyTemplate(id),
                })),
              ]}
            />
            <Button variant="outline" size="sm" onClick={() => setCopyOpen(true)}>
              {t("scheme.copy.action")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<UsersRound aria-hidden className="size-4" />}
              disabled={!saved || dirty}
              title={dirty ? t("scheme.applyTo.saveFirst") : undefined}
              onClick={() => setApplyOpen(true)}
            >
              {t("scheme.applyTo.action")}
            </Button>
          </div>
        )}
      </div>

      {/* З6: «Действует с» и история версий схемы */}
      <div
        data-f="F-09-037"
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
      >
        <FormField
          label={t("scheme.effectiveFrom")}
          hint={t("scheme.effectiveFromHint")}
        >
          <DatePicker
            value={draft.effectiveFrom ?? null}
            min={minEffective}
            disabled={!canManage}
            clearable={!saved}
            onValueChange={(d) => {
              setFromTouched(true);
              setDraft({ ...draft, effectiveFrom: d ?? undefined });
            }}
            className="sm:max-w-60"
          />
        </FormField>
        {versions.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
              <History aria-hidden className="size-4 text-muted" />
              {t("scheme.versionsTitle")}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {versions.map((v, i) => (
                <li key={`${v.effectiveFrom ?? "start"}-${i}`}>
                  <Badge tone={i === versions.length - 1 ? "primary" : "neutral"}>
                    {v.effectiveFrom
                      ? t("scheme.versionFrom", { date: dayjs(v.effectiveFrom).format("DD.MM.YYYY") })
                      : t("scheme.versionSince")}
                    {i === versions.length - 1 ? ` · ${t("scheme.versionCurrent")}` : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* F-09-011: у ролей без payroll.manage (например «мастер») блоки только читаются — fieldset
          отключает вложенные input/button на уровне DOM, независимо от того, какой компонент их рендерит */}
      <fieldset
        disabled={!canManage}
        className="flex flex-col gap-4 border-0 p-0 m-0 min-w-0"
      >
        <PersonalServicesBlockCard
          value={draft.personalServices}
          onChange={(personalServices) =>
            update({ ...draft, personalServices })
          }
          targets={serviceTargets}
          assistCompensationEnabled={
            generalSettingsQuery.data?.assistCompensationEnabled ?? false
          }
        />
        <ProductSalesBlockCard
          value={draft.productSales}
          onChange={(productSales) => update({ ...draft, productSales })}
          targets={productTargets}
        />
        <WorkdayBlockCard
          value={draft.workday}
          onChange={(workday) => update({ ...draft, workday })}
        />
        <RecordsBlockCard
          value={draft.records}
          onChange={(records) => update({ ...draft, records })}
          targets={serviceTargets}
        />
        <ExtraRevenueBlockCard
          kind="services"
          value={draft.extraServiceRevenue}
          onChange={(extraServiceRevenue) =>
            update({ ...draft, extraServiceRevenue })
          }
        />
        <ExtraRevenueBlockCard
          kind="products"
          value={draft.extraProductRevenue}
          onChange={(extraProductRevenue) =>
            update({ ...draft, extraProductRevenue })
          }
        />
      </fieldset>

      {canManage && (
        <StickyActionBar
          desktop="inline"
          summary={
            issues.length > 0 ? (
              <span className="text-danger">
                {t("scheme.issues", { count: issues.length })}{" "}
                <button
                  type="button"
                  onClick={showFirstIssue}
                  className="font-medium underline underline-offset-2"
                >
                  {t("scheme.issuesShow")}
                </button>
              </span>
            ) : undefined
          }
        >
          <Button
            variant="ghost"
            leftIcon={<Undo2 aria-hidden className="size-4" />}
            onClick={handleReset}
            disabled={!dirty || save.isPending}
          >
            {t("scheme.reset")}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!dirty || issues.length > 0}
            loading={save.isPending}
          >
            {t("scheme.save")}
          </Button>
        </StickyActionBar>
      )}

      <CopySchemeDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        excludeStaffId={staffId}
        candidates={candidatesQuery.data ?? []}
        onCopied={(scheme) =>
          update({
            ...scheme,
            createdAt: draft.createdAt,
            effectiveFrom: draft.effectiveFrom,
            history: draft.history,
          })
        }
      />
      {saved && (
        <ApplySchemeDialog
          open={applyOpen}
          onOpenChange={setApplyOpen}
          sourceStaffId={staffId}
          candidates={candidatesQuery.data ?? []}
          minDate={minEffective}
        />
      )}
    </div>
  );
}
