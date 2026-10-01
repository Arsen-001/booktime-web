"use client";

/**
 * /biz/payroll/settings — «Основные настройки» на филиал (F-09-004, F-09-005, F-09-008). Принадлежит
 * разделу «payroll». Комиссия эквайринга (F-09-007) — переключатель варианта сохраняется, сам расчёт
 * суммы комиссии ждёт finance (следующая пачка).
 */
import { useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import type {
  AccrualDateBasis,
  AssistantSplitRule,
  BankCommissionSplit,
  GeneralSettings,
  PayrollModel,
  PayrollScopeAccess,
  PayrollStaffRights,
} from "@/domain/payroll";
import { defaultPayrollStaffRights } from "@/domain/payroll";
import {
  defaultGeneralSettings,
  getGeneralSettings,
  listPayrollRights,
  saveGeneralSettings,
  savePayrollRightsBatch,
} from "@/api/payroll";
import { splitBankCommission } from "@/domain/payroll";
import { useCoreList } from "@/api/core";
import { optimistic, useApiMutation, useApiQuery } from "@/api/request";
import { nowDateTime } from "@/lib/date";
import { useCan, useCurrent } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { useToast } from "@/ui/Toast";
import { useUnsavedGuard } from "@/ui/hooks/useUnsavedGuard";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Checkbox } from "@/ui/Checkbox";
import { ChoiceGroup } from "@/ui/ChoiceGroup";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { Input } from "@/ui/Input";
import { PageHeader } from "@/ui/PageHeader";
import { SectionCard } from "@/ui/SectionCard";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { Select } from "@/ui/Select";
import { SkeletonText } from "@/ui/Skeleton";
import { StickyActionBar } from "@/ui/StickyActionBar";
import { Switch } from "@/ui/Switch";

export function GeneralSettingsScreen() {
  const t = useT("payroll");
  const toast = useToast();
  const {
    ready,
    businessId,
    locationId: currentLocationId,
    activeLocationIds,
  } = useCurrent();
  const locationId =
    currentLocationId === "all" ? activeLocationIds[0] : currentLocationId;
  const canManage = useCan("payroll.manage");
  // F-09-089: базовое право раздела — без него нет доступа даже на просмотр (staff.manage не считается).
  const canViewPayroll = useCan("payroll.view") || canManage;

  const q = useApiQuery(
    ["payroll", "settings", locationId],
    () => getGeneralSettings(locationId!),
    {
      enabled: ready && Boolean(locationId),
    },
  );
  const [draft, setDraft] = useState<GeneralSettings | null>(null);
  // Подхват настроек по id локации — правка состояния при рендере (не в эффекте, §18 п. 6)
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (ready && locationId && loadedFor !== locationId && !q.isLoading) {
    setLoadedFor(locationId);
    setDraft(q.data ?? defaultGeneralSettings(locationId, nowDateTime()));
  }

  // Пока настройки грузятся — та же форма со значениями по умолчанию (в демо они и есть), поля отключены:
  // приехали данные — меняются только отметки, ничего не сдвигается
  const settingsLoading = !ready || q.isLoading || !draft;
  const d = draft ?? defaultGeneralSettings(locationId ?? "", "");

  const settingsDirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(q.data ?? null);
  // З14: права сотрудников копятся тут же и сохраняются той же кнопкой, что и настройки
  const [pendingRights, setPendingRights] = useState<Record<string, PayrollStaffRights>>({});
  const rightsDirty = Object.keys(pendingRights).length > 0;
  const dirty = settingsDirty || rightsDirty;
  useUnsavedGuard(dirty);
  const save = useApiMutation(saveGeneralSettings);
  // М2: один запрос на все правки прав; кэш прав правится на месте — без перечитывания и тоста на каждый клик
  const saveRights = useApiMutation(savePayrollRightsBatch, {
    optimistic: optimistic<Record<string, PayrollStaffRights>, PayrollStaffRights[]>(
      ["payroll", "rights", businessId],
      (old, list) => {
        const next = { ...old };
        for (const r of list) next[r.staffId] = r;
        return next;
      },
    ),
  });
  const onPendingRightsChange = (staffId: string, next: PayrollStaffRights | undefined) =>
    setPendingRights((prev) => {
      const copy = { ...prev };
      if (next) copy[staffId] = next;
      else delete copy[staffId];
      return copy;
    });

  const accrualOptions: {
    value: AccrualDateBasis;
    title: string;
    description: string;
  }[] = [
    {
      value: "visit",
      title: t("settings.accrual.visit.title"),
      description: t("settings.accrual.visit.description"),
    },
    {
      value: "received",
      title: t("settings.accrual.received.title"),
      description: t("settings.accrual.received.description"),
    },
  ];
  const commissionOptions: {
    value: BankCommissionSplit;
    title: string;
    description: string;
  }[] = [
    {
      value: "staffAssistBusiness",
      title: t("settings.commission.staffAssistBusiness.title"),
      description: t("settings.commission.staffAssistBusiness.description"),
    },
    {
      value: "staffBusiness",
      title: t("settings.commission.staffBusiness.title"),
      description: t("settings.commission.staffBusiness.description"),
    },
    {
      value: "staffAssist",
      title: t("settings.commission.staffAssist.title"),
      description: t("settings.commission.staffAssist.description"),
    },
    {
      value: "staffOnly",
      title: t("settings.commission.staffOnly.title"),
      description: t("settings.commission.staffOnly.description"),
    },
    {
      value: "businessOnly",
      title: t("settings.commission.businessOnly.title"),
      description: t("settings.commission.businessOnly.description"),
    },
  ];

  async function handleSave() {
    if (!draft) return;
    try {
      if (settingsDirty) {
        const saved = await save.mutate(draft);
        setDraft(saved);
      }
      if (rightsDirty) {
        await saveRights.mutate(Object.values(pendingRights));
        setPendingRights({});
      }
      toast.success(t("settings.saveSuccess"));
    } catch {
      toast.error(t("settings.saveError"));
    }
  }

  // F-09-089: гейт после всех хуков, до основного JSX.
  if (ready && !canViewPayroll) {
    return (
      <div data-f="F-09-089" className="mx-auto w-full max-w-[760px] flex flex-col gap-6">
        <PageHeader title={t("nav.settings")} />
        <EmptyState
          icon={<Lock aria-hidden className="size-8 text-muted" />}
          title={t("access.deniedHint")}
        />
      </div>
    );
  }

  return (
    <div data-f="F-09-004 F-09-082" className="mx-auto w-full max-w-[760px] flex min-w-0 flex-col gap-6">
      <PageHeader
        title={t("nav.settings")}
        description={t("settings.description")}
      />

      {q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : (
        <>
          {!canManage && (
            <p className="text-sm text-muted">{t("settings.readOnlyHint")}</p>
          )}
          {/* F-09-008/F-09-007: у ролей без payroll.manage (например «мастер») поля только читаются —
              fieldset отключает вложенные input/button на уровне DOM, тот же приём, что в SchemeEditor.tsx */}
          <fieldset
            disabled={!canManage || settingsLoading}
            aria-busy={settingsLoading || undefined}
            className="flex flex-col gap-6 border-0 p-0 m-0 min-w-0"
          >
            <div data-f="F-09-005">
              <SectionCard
                title={t("settings.accrual.title")}
                description={t("settings.accrual.description")}
              >
                <ChoiceGroup
                  options={accrualOptions}
                  value={d.accrualDateBasis}
                  onValueChange={(v) =>
                    setDraft({
                      ...d,
                      accrualDateBasis: v as AccrualDateBasis,
                    })
                  }
                  aria-label={t("settings.accrual.title")}
                />
              </SectionCard>
            </div>

            <div data-f="F-09-007 F-09-107 F-16-146">
              <SectionCard
                title={t("settings.commission.title")}
                description={t("settings.commission.description")}
              >
                <ChoiceGroup
                  options={commissionOptions}
                  value={d.bankCommissionSplit}
                  onValueChange={(v) =>
                    setDraft({
                      ...d,
                      bankCommissionSplit: v as BankCommissionSplit,
                    })
                  }
                  aria-label={t("settings.commission.title")}
                />
                <p className="pt-3 text-sm text-muted">
                  {t("settings.commission.sourceHint")}
                </p>
                {(() => {
                  // F-09-007: пример из справки — комиссия 10, ставка мастера 40%, ассистента 10%
                  const example = splitBankCommission(
                    {
                      commissionAmount: 10,
                      masterRatePct: 40,
                      assistantRatesPct: [10],
                    },
                    d.bankCommissionSplit,
                  );
                  return (
                    <div className="mt-3 rounded-lg border border-border bg-surface-2/50 p-3">
                      <p className="text-xs font-medium text-muted">
                        {t("settings.commission.example.title")}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg">
                        <span>
                          {t("settings.commission.example.master")}:{" "}
                          {example.master} ֏
                        </span>
                        <span>
                          {t("settings.commission.example.assistant")}:{" "}
                          {example.assistants[0]} ֏
                        </span>
                        <span>
                          {t("settings.commission.example.business")}:{" "}
                          {example.business} ֏
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </SectionCard>
            </div>

            <div data-f="F-09-008">
              <SectionCard
                title={t("settings.assist.title")}
                description={t("settings.assist.description")}
              >
                <Switch
                  checked={d.assistCompensationEnabled}
                  onCheckedChange={(assistCompensationEnabled) =>
                    setDraft({ ...d, assistCompensationEnabled })
                  }
                  label={t("settings.assist.toggle")}
                />
                {d.assistCompensationEnabled && (
                  <div
                    data-f="F-09-009"
                    className="flex flex-col gap-3 border-t border-border pt-4"
                  >
                    <Switch
                      checked={d.multipleAssistantsAllowed}
                      onCheckedChange={(multipleAssistantsAllowed) =>
                        setDraft({ ...d, multipleAssistantsAllowed })
                      }
                      label={t("settings.assist.multipleToggle")}
                      description={t("settings.assist.multipleHint")}
                    />
                    {d.multipleAssistantsAllowed && (
                      <ChoiceGroup
                        options={[
                          {
                            value: "fullEach",
                            title: t("settings.assist.split.fullEach.title"),
                            description: t(
                              "settings.assist.split.fullEach.description",
                            ),
                          },
                          {
                            value: "shared",
                            title: t("settings.assist.split.shared.title"),
                            description: t(
                              "settings.assist.split.shared.description",
                            ),
                          },
                        ]}
                        value={d.assistantSplitRule}
                        onValueChange={(v) =>
                          setDraft({
                            ...d,
                            assistantSplitRule: v as AssistantSplitRule,
                          })
                        }
                        aria-label={t("settings.assist.splitAriaLabel")}
                      />
                    )}
                    <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                      <p className="text-sm text-muted">
                        {t("settings.assist.configureHint")}
                      </p>
                      <Link
                        href="/biz/payroll"
                        className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-accent-text hover:underline"
                      >
                        {t("settings.assist.configure")}
                      </Link>
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>
            <div data-f="F-09-002">
              <SectionCard
                title={t("settings.model.title")}
                description={t("settings.model.description")}
              >
                <SegmentedControl
                  value={d.payrollModel}
                  onValueChange={(v) =>
                    setDraft({ ...d, payrollModel: v as PayrollModel })
                  }
                  options={[
                    {
                      value: "simplified",
                      label: t("settings.model.simplified"),
                    },
                    { value: "classic", label: t("settings.model.classic") },
                  ]}
                />
                {d.payrollModel === "classic" && (
                  <p className="pt-3 text-sm text-muted">
                    {t("settings.model.classicHint")}
                  </p>
                )}
              </SectionCard>
            </div>

            <div data-f="F-09-100">
              <SectionCard
                title={t("settings.approval.title")}
                description={t("settings.approval.description")}
              >
                <Switch
                  checked={d.statementApprovalEnabled}
                  onCheckedChange={(statementApprovalEnabled) =>
                    setDraft({ ...d, statementApprovalEnabled })
                  }
                  label={t("settings.approval.toggle")}
                />
              </SectionCard>
            </div>

            <div data-f="F-09-101">
              <SectionCard
                title={t("settings.fund.title")}
                description={t("settings.fund.description")}
              >
                <div className="flex flex-wrap gap-4">
                  <label className="flex flex-col gap-1 text-sm text-muted">
                    {t("settings.fund.targetLabel")}
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={d.payrollFundTargetPct}
                      onChange={(e) =>
                        setDraft({
                          ...d,
                          payrollFundTargetPct: Math.min(
                            100,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        })
                      }
                      className="w-24"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-muted">
                    {t("settings.fund.warnLabel")}
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={d.payrollFundWarnPct}
                      onChange={(e) =>
                        setDraft({
                          ...d,
                          payrollFundWarnPct: Math.min(
                            100,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        })
                      }
                      className="w-24"
                    />
                  </label>
                </div>
              </SectionCard>
            </div>

            <div data-f="F-09-083">
              <SectionCard
                title={t("settings.tips.title")}
                description={t("settings.tips.description")}
              />
            </div>

            <div data-f="F-09-098">
              <SectionCard
                title={t("settings.autoPayroll.title")}
                description={t("settings.autoPayroll.description")}
              />
            </div>
          </fieldset>

          <AccessRightsSection
            pending={pendingRights}
            onPendingChange={onPendingRightsChange}
          />

          {(canManage || rightsDirty) && (
            <StickyActionBar desktop="sticky">
              <Button
                onClick={handleSave}
                disabled={!dirty}
                loading={save.isPending || saveRights.isPending}
              >
                {t("settings.save")}
              </Button>
            </StickyActionBar>
          )}
        </>
      )}
    </div>
  );
}

/**
 * F-09-085…089: права раздела по сотруднику — заготовка до отдельных прав в src/config/permissions.ts
 * (qa/requests/payroll.md). Владелец задаёт их здесь; экраны раздела читают через usePayrollAccess().
 * Зарплата-ревью З14/М2: одно правило со всей страницей — правки копятся в черновике и сохраняются кнопкой
 * одним запросом; кэш прав правится на месте (optimistic), список не перечитывается и не мигает.
 */
interface AccessRightsSectionProps {
  pending: Record<string, PayrollStaffRights>;
  onPendingChange: (staffId: string, next: PayrollStaffRights | undefined) => void;
}

function AccessRightsSection({ pending, onPendingChange }: AccessRightsSectionProps) {
  const t = useT("payroll");
  const { ready, businessId } = useCurrent();
  const canManageStaff = useCan("staff.manage");
  const staffQuery = useCoreList(
    "staff",
    { businessId },
    { enabled: ready && Boolean(businessId) },
  );
  const rightsKey = ["payroll", "rights", businessId] as const;
  const rightsQuery = useApiQuery(
    rightsKey,
    () => listPayrollRights(businessId!),
    { enabled: ready && Boolean(businessId) },
  );
  if (!canManageStaff) return null;

  // Владелец не входит в список — у него всегда полный доступ (resolvePayrollAccess), права ниже
  // сужают только администраторов и мастеров.
  const staffList = (staffQuery.data ?? []).filter(
    (s) =>
      s.status !== "fired" && s.status !== "disabled" && s.role !== "owner",
  );
  const rightsFor = (staffId: string): PayrollStaffRights =>
    pending[staffId] ??
    rightsQuery.data?.[staffId] ??
    defaultPayrollStaffRights(staffId, "");

  const update = (staffId: string, patch: Partial<PayrollStaffRights>) => {
    const saved =
      rightsQuery.data?.[staffId] ?? defaultPayrollStaffRights(staffId, "");
    const next = { ...rightsFor(staffId), ...patch, staffId };
    const same =
      next.schemesAccess === saved.schemesAccess &&
      next.calcAccess === saved.calcAccess &&
      next.accrueAccess === saved.accrueAccess &&
      next.ownOnlyStaffId === saved.ownOnlyStaffId;
    onPendingChange(staffId, same ? undefined : next);
  };

  const scopeOptions: { value: PayrollScopeAccess; label: string }[] = [
    { value: "none", label: t("access.scope.none") },
    { value: "today", label: t("access.scope.today") },
    { value: "all", label: t("access.scope.all") },
  ];

  return (
    <div
      data-f="F-09-085 F-09-086 F-09-087 F-09-088 F-09-089"
      className="flex min-w-0 flex-col gap-3"
    >
      <SectionCard
        title={t("access.title")}
        description={t("access.description")}
      >
        {staffQuery.isLoading || rightsQuery.isLoading ? (
          <div className="flex flex-col gap-3" aria-busy>
            {["14ch", "18ch", "12ch", "16ch", "15ch"].map((w) => (
              <Card key={w} padding="sm" className="flex min-w-0 flex-col gap-3">
                <p className="flex items-center gap-2 font-medium text-fg">
                  <SkeletonText width={w} />
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Checkbox checked={false} disabled label={t("access.schemes")} />
                  <Checkbox checked={false} disabled label={t("access.ownOnly")} />
                </div>
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <label className="flex min-w-0 flex-col gap-1 text-sm text-muted">
                    {t("access.calcLabel")}
                    <Select options={scopeOptions} value="none" onValueChange={() => {}} disabled />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1 text-sm text-muted">
                    {t("access.accrueLabel")}
                    <Select options={scopeOptions} value="none" onValueChange={() => {}} disabled />
                  </label>
                </div>
              </Card>
            ))}
          </div>
        ) : staffList.length === 0 ? (
          <p className="text-sm text-muted">{t("access.empty")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {staffList.map((s) => {
              const rights = rightsFor(s.id);
              return (
                <Card key={s.id} padding="sm" className="flex min-w-0 flex-col gap-3">
                  <p className="flex items-center gap-2 font-medium text-fg">
                    {s.name}
                    {pending[s.id] && <Badge tone="warning">•</Badge>}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Checkbox
                      checked={rights.schemesAccess}
                      onCheckedChange={(v) =>
                        update(s.id, { schemesAccess: Boolean(v) })
                      }
                      label={t("access.schemes")}
                    />
                    <Checkbox
                      checked={Boolean(rights.ownOnlyStaffId)}
                      onCheckedChange={(v) =>
                        update(s.id, { ownOnlyStaffId: v ? s.id : undefined })
                      }
                      label={t("access.ownOnly")}
                    />
                  </div>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <label className="flex min-w-0 flex-col gap-1 text-sm text-muted">
                      {t("access.calcLabel")}
                      <Select
                        options={scopeOptions}
                        value={rights.calcAccess}
                        onValueChange={(v) =>
                          update(s.id, { calcAccess: v as PayrollScopeAccess })
                        }
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-sm text-muted">
                      {t("access.accrueLabel")}
                      <Select
                        options={scopeOptions}
                        value={rights.accrueAccess}
                        onValueChange={(v) =>
                          update(s.id, {
                            accrueAccess: v as PayrollScopeAccess,
                          })
                        }
                      />
                    </label>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-sm text-muted">{t("access.foundationHint")}</p>
      </SectionCard>
    </div>
  );
}
