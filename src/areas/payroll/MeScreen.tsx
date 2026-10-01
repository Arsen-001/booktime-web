"use client";

/**
 * /biz/payroll/me — «Расчёт зарплат» с телефона (F-09-092/093/094): вкладки «Расчёт» и «Выплаты».
 * Принадлежит разделу «payroll». В отличие от /biz/apps/payroll (раздел «client», F-14-127/128, общая
 * демо-симуляция «Приложения» без реальной формулы), здесь зарплата — настоящий расчёт движка payroll
 * (computeStatement) и настоящий баланс взаиморасчётов (getStaffBalance) — тот же, что во «Взаиморасчётах».
 */
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, Wallet } from "lucide-react";
import {
  computeStatement,
  getStaffBalance,
  getStaffWorkedHours,
  listSettlementEntries,
} from "@/api/payroll";
import { useCoreList } from "@/api/core";
import { useApiQuery } from "@/api/request";
import { usePayrollAccess } from "@/areas/payroll/access";
import { useCurrent, useDemo } from "@/demo/hooks";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { today } from "@/lib/date";
import { Card } from "@/ui/Card";
import { DateRangePicker, presetRange } from "@/ui/DateRangePicker";
import type { DateRange } from "@/ui/Calendar";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { PageHeader } from "@/ui/PageHeader";
import { Select } from "@/ui/Select";
import { Skeleton, SkeletonText } from "@/ui/Skeleton";
import { Tabs } from "@/ui/Tabs";

export function MeScreen() {
  const t = useT("payroll");
  const { ready, businessId, staffId, activeLocationIds } = useCurrent();
  const access = usePayrollAccess();
  const [tab, setTab] = useState<"calc" | "payouts">("calc");
  const staffQuery = useCoreList(
    "staff",
    { businessId },
    {
      enabled:
        ready && Boolean(businessId) && access.ownOnlyStaffId === undefined,
    },
  );

  const canSeeOthers = !access.ownOnlyStaffId;
  // F-09-092/102: право «только свой расчёт» защищает данные, но даже когда его нет (мастер может
  // выбрать коллегу), экран по умолчанию должен показывать СВОЮ зарплату, а не пустой выбор.
  const [selectedStaffId, setSelectedStaffId] = useState<string | undefined>(
    staffId,
  );
  const targetStaffId = canSeeOthers
    ? (selectedStaffId ?? staffId)
    : (access.ownOnlyStaffId ?? staffId);

  const currentDayOnly = access.calcAccess === "today";
  // Владелец и сеть — своей зарплаты в демо у них нет
  const { persona } = useDemo();
  const ownerView = persona === "owner" || persona === "network";
  const [range, setRange] = useState<DateRange>(presetRange("thisMonth"));
  const effectiveRange: DateRange = currentDayOnly
    ? { from: today(), to: today() }
    : range;

  // Пока демо-контекст не готов — та же страница (выбор сотрудника, вкладки, период, плитки), без данных
  if (!ready)
    return (
      <div className="flex flex-col gap-6" aria-busy>
        <PageHeader title={t("me.title")} description={t("me.subtitle")} />
        <Select options={[]} value="" onValueChange={() => {}} placeholder={t("me.chooseStaff")} disabled />
        <div className="flex flex-col gap-4">
          <Tabs
            value="calc"
            onValueChange={() => {}}
            items={[
              { value: "calc", label: t("me.tabCalc") },
              { value: "payouts", label: t("me.tabPayouts") },
            ]}
          />
          <DateRangePicker value={range} onValueChange={setRange} presets />
          <CalcTabView emptyLikely={ownerView} />
        </div>
      </div>
    );
  if (access.calcAccess === "none") {
    return (
      <div data-f="F-09-094" className="flex flex-col gap-6">
        <PageHeader title={t("me.title")} />
        <EmptyState
          icon={<Wallet aria-hidden className="size-8 text-muted" />}
          title={t("me.noAccess")}
        />
      </div>
    );
  }

  return (
    <div
      data-f="F-09-092 F-09-093 F-09-094 F-09-102"
      className="flex flex-col gap-6"
    >
      <PageHeader title={t("me.title")} description={t("me.subtitle")} />

      {canSeeOthers && (
        <Select
          options={(staffQuery.data ?? []).map((s) => ({
            value: s.id,
            label: s.name,
          }))}
          value={selectedStaffId ?? ""}
          onValueChange={(v) => setSelectedStaffId(v || undefined)}
          placeholder={t("me.chooseStaff")}
        />
      )}

      {!targetStaffId ? (
        <EmptyState
          icon={<Wallet aria-hidden className="size-8 text-muted" />}
          title={t("me.chooseStaff")}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as typeof tab)}
            items={[
              { value: "calc", label: t("me.tabCalc") },
              { value: "payouts", label: t("me.tabPayouts") },
            ]}
          />
          {currentDayOnly ? (
            <p
              data-f="F-09-094"
              className="flex items-center gap-2 text-sm text-muted"
            >
              <CalendarDays aria-hidden className="size-4" />{" "}
              {t("me.todayOnly")}
            </p>
          ) : (
            <DateRangePicker value={range} onValueChange={setRange} presets />
          )}
          {tab === "calc" ? (
            <CalcTab
              emptyLikely={ownerView && targetStaffId === staffId}
              staffId={targetStaffId}
              locationId={activeLocationIds[0]}
              range={effectiveRange}
            />
          ) : (
            <PayoutsTab
              businessId={businessId!}
              staffId={targetStaffId}
              canOpenSettlements={access.accrueAccess !== "none"}
            />
          )}
        </div>
      )}
    </div>
  );
}

function CalcTab({
  staffId,
  locationId,
  range,
  emptyLikely,
}: {
  /** Владелец смотрит свою зарплату — начислений у него обычно нет: скелетон в форме пустого состояния */
  emptyLikely: boolean;
  staffId: string;
  locationId: string | undefined;
  range: DateRange;
}) {
  const t = useT("payroll");
  const format = useFormat();
  const from = range.from ?? today();
  const to = range.to ?? from;
  const q = useApiQuery(
    ["payroll", "meCalc", locationId, staffId, from, to],
    () => computeStatement(locationId!, staffId, from, to),
    {
      enabled: Boolean(locationId),
    },
  );
  // F-09-092: «Рабочее время (дни и часы)» — одно правило с «Расчётом» и «Приложения → Зарплата»: дни и часы
  // графика за период (final-fix 01.10: было «1 день» по операциям и 196 ч графика). Расчёт отдаёт их сам;
  // отдельный запрос — только если сервер старой сборки их не прислал.
  const statementHasHours = q.data?.workHours !== undefined;
  const hoursQ = useApiQuery(
    ["payroll", "meHours", locationId, staffId, from, to],
    () => getStaffWorkedHours(locationId!, staffId, from, to),
    { enabled: Boolean(locationId) && Boolean(q.data) && !statementHasHours },
  );

  if (q.isLoading) return <CalcTabView emptyLikely={emptyLikely} />;
  if (q.isError || !q.data)
    return <ErrorState onRetry={() => void q.refetch()} />;
  const days = q.data.workDays ?? new Set(q.data.operations.map((o) => o.date)).size;
  const hours = q.data.workHours ?? hoursQ.data ?? 0;
  const servicesCount = q.data.operations.reduce(
    (n, op) => n + op.lines.filter((l) => l.kind === "service").length,
    0,
  );
  const servicesValue = q.data.operations.reduce((s, op) => s + op.revenue, 0);

  const salary = q.data.salary ?? q.data.total;
  // Пусто — только если нет ни услуг, ни начислений, ни рабочих дней (у администратора на «рабочем дне» услуг нет)
  if (q.data.operations.length === 0 && salary === 0 && !(q.data.workDays ?? 0))
    return (
      <EmptyState
        icon={<Wallet aria-hidden className="size-8 text-muted" />}
        title={t("me.empty")}
      />
    );

  return (
    <CalcTabView
      values={{
        days,
        hours: hours || "—",
        servicesCount,
        servicesValue: format.money(servicesValue),
        // «Зарплата за период» — та же цифра, что строка «Расчёта» (рабочий день, оклад, минимум месяца)
        total: format.money(salary),
        ahead:
          (q.data.scheduledAheadDays ?? 0) > 0
            ? t("me.scheduledAhead", { days: q.data.scheduledAheadDays ?? 0, hours: q.data.scheduledAheadHours ?? 0 })
            : undefined,
      }}
    />
  );
}

/** Плитки расчёта; без values — скелетон той же разметки (подписи на месте, числа полосой в той же строке) */
function CalcTabView({
  values,
  emptyLikely = false,
}: {
  values?: { days: number; hours: number | string; servicesCount: number; servicesValue: string; total: string; ahead?: string };
  emptyLikely?: boolean;
}) {
  const t = useT("payroll");
  if (!values && emptyLikely)
    return (
      <EmptyState
        icon={<Wallet aria-hidden className="size-8 text-muted" />}
        title={
          <>
            <span className="block md:hidden">
              <Skeleton lines={2} />
            </span>
            <span className="hidden md:inline">
              <SkeletonText width="34ch" />
            </span>
          </>
        }
        className="animate-none!"
      />
    );
  const v = (node: ReactNode, width: string) => (values ? node : <SkeletonText width={width} />);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t("me.daysWorked")}</span>
        <span className="text-lg font-semibold text-fg">{v(values?.days, "2ch")}</span>
      </Card>
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t("me.hoursWorked")}</span>
        <span className="text-lg font-semibold text-fg">{v(values?.hours, "3ch")}</span>
      </Card>
      {/* Решение 01.10: «отработано» — по сегодня; график дальше — только подпись, в зарплату не идёт */}
      {values?.ahead && <p className="col-span-full -mt-1 text-xs text-muted">{values.ahead}</p>}
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t("me.servicesCount")}</span>
        <span className="text-lg font-semibold text-fg">{v(values?.servicesCount, "2ch")}</span>
      </Card>
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t("me.servicesValue")}</span>
        <span className="text-lg font-semibold text-fg">{v(values?.servicesValue, "10ch")}</span>
      </Card>
      <Card
        padding="sm"
        className="col-span-full flex flex-col gap-1 bg-surface-2"
      >
        <span className="text-xs text-muted">{t("me.totalSalary")}</span>
        <span className="text-xl font-semibold text-fg">{v(values?.total, "10ch")}</span>
      </Card>
    </div>
  );
}

function PayoutsTab({
  businessId,
  staffId,
  canOpenSettlements,
}: {
  businessId: string;
  staffId: string;
  canOpenSettlements: boolean;
}) {
  const t = useT("payroll");
  const format = useFormat();
  const q = useApiQuery(["payroll", "staffBalance", businessId, staffId], () =>
    getStaffBalance(businessId, staffId),
  );
  // F-09-114: сотрудник с правом на СВОЮ зарплату видит начисления, премии, штрафы и выплаты построчно
  // здесь же, не только ссылкой на «Взаиморасчёты» (право туда — отдельное, F-09-078, не у всех мастеров).
  const entriesQ = useApiQuery(
    ["payroll", "settlementEntries", businessId, staffId],
    () => listSettlementEntries(businessId, staffId),
  );

  if (q.isError || (!q.isLoading && !q.data))
    return <ErrorState onRetry={() => void q.refetch()} />;
  const balance = q.data;

  const entryLabel = (kind: string) =>
    kind === "sheet"
      ? t("me.entryKind.sheet")
      : kind === "bonus"
        ? t("me.entryKind.bonus")
        : kind === "penalty"
          ? t("me.entryKind.penalty")
          : kind === "payout"
            ? t("me.entryKind.payout")
            : t("me.entryKind.adjustment");

  return (
    <div data-f="F-09-093 F-09-114" className="flex flex-col gap-3">
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t("me.earned")}</span>
        <span className="text-lg font-semibold text-fg">
          {balance ? format.money(balance.earned) : <SkeletonText width="10ch" />}
        </span>
      </Card>
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t("me.paid")}</span>
        <span className="text-lg font-semibold text-success">
          {balance ? format.money(balance.paid) : <SkeletonText width="10ch" />}
        </span>
      </Card>
      <Card padding="sm" className="flex flex-col gap-1 bg-surface-2">
        <span className="text-xs text-muted">{t("me.remaining")}</span>
        <span className="text-xl font-semibold text-fg">
          {balance ? format.money(balance.remaining) : <SkeletonText width="10ch" />}
        </span>
      </Card>

      {entriesQ.isLoading ? (
        <ul className="flex flex-col gap-1.5">
          {["16ch", "12ch", "18ch"].map((w) => (
            <li key={w} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">
                  <SkeletonText width={w} />
                </p>
                <p className="text-xs text-muted">
                  <SkeletonText width="9ch" />
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">
                <SkeletonText width="9ch" />
              </span>
            </li>
          ))}
        </ul>
      ) : entriesQ.isError ? (
        <ErrorState onRetry={() => void entriesQ.refetch()} />
      ) : !entriesQ.data?.length ? (
        <EmptyState compact title={t("me.entriesEmpty")} />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {[...entriesQ.data].reverse().map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">
                  {entryLabel(e.kind)}
                  {e.label ? ` · ${e.label}` : ""}
                </p>
                <p className="text-xs text-muted">{format.date(e.createdAt)}</p>
              </div>
              <span
                className={`shrink-0 tabular-nums font-semibold ${
                  e.kind === "payout" || e.kind === "penalty"
                    ? "text-danger"
                    : "text-success"
                }`}
              >
                {e.kind === "payout" || e.kind === "penalty" ? "−" : "+"}
                {format.money(e.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canOpenSettlements && (
        <Link
          href={`/biz/payroll/settlements?staffId=${staffId}`}
          className="text-sm text-primary-text underline underline-offset-2"
        >
          {t("me.openSettlements")}
        </Link>
      )}
    </div>
  );
}
