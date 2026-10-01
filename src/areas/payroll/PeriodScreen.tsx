"use client";

/**
 * /biz/payroll/period — «Расчёт за период» (F-09-062, F-09-064). Принадлежит разделу «payroll».
 * «Создать ведомость» в строке (F-09-063) и выгрузка в Excel (F-09-065) зовут общую api-функцию
 * finance (createSettlementSheet, F-07-162) — её сумма считается ТЕМ ЖЕ расчётом, что строки здесь
 * (computeStaffPay в api/payroll.ts, зарплата-ревью З1/З2).
 *
 * Зарплата-ревью 27.09: «К выплате» и «Начислить всем» — с премиями и штрафами (З7), «Оплачено в кассу» —
 * выручка минус неоплаченное, отдельная плашка про неоплаченные визиты (З3), «Закрыть период» (З11),
 * CSV с часами, числом услуг и премиями (З19), должность на языке интерфейса (З20), шапка и фильтры сразу,
 * скелет у каждого блока (М1).
 */
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  AlertTriangle,
  ArrowRightLeft,
  FileDown,
  Lock,
  LockKeyhole,
  MoreHorizontal,
  Wallet,
} from "lucide-react";
import { closePayrollPeriod, computePeriod, getGeneralSettings } from "@/api/payroll";
import { createSettlementSheet, listSettlementEntries } from "@/api/finance";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useCoreList } from "@/api/core";
import type { Id, LocaleCode } from "@/domain/core";
import type { SettlementEntry } from "@/domain/finance";
import type { PeriodRow } from "@/domain/payroll";
import { useCan, useCurrent } from "@/demo/hooks";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { dayjs, toISODate, today } from "@/lib/date";
import { downloadCsv, toCsv } from "@/lib/csv";
import { pickText } from "@/lib/text";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { DateRangePicker } from "@/ui/DateRangePicker";
import type { DateRange } from "@/ui/Calendar";
import { DropdownMenu, type DropdownMenuItem } from "@/ui/DropdownMenu";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { FilterBar } from "@/ui/FilterBar";
import { IconButton } from "@/ui/IconButton";
import { PageHeader } from "@/ui/PageHeader";
import { usePagedList } from "@/ui/Pagination";
import { Reveal } from "@/ui/Reveal";
import { Select } from "@/ui/Select";
import { StatCard } from "@/ui/StatCard";
import { useConfirm, useToast } from "@/ui/Toast";
import { PayrollNotConfigured } from "@/areas/payroll/shared/PayrollNotConfigured";
import { usePayrollAccess } from "@/areas/payroll/access";
import { PeriodStaffCard, PeriodStaffCardSkeleton } from "@/areas/payroll/period/PeriodStaffCard";
import { Skeleton, SkeletonText } from "@/ui/Skeleton";

interface Row extends PeriodRow {
  staffName: string;
  position?: string;
}

const toPayOf = (r: PeriodRow) => r.breakdown?.toPay ?? r.salary;

export function PeriodScreen() {
  const t = useT("payroll");
  const { money, duration } = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const locale = useLocale() as LocaleCode;
  const {
    ready,
    businessId,
    locationId: currentLocationId,
    activeLocationIds,
  } = useCurrent();
  const locationId =
    currentLocationId === "all" ? activeLocationIds[0] : currentLocationId;
  const canManagePayroll = useCan("payroll.manage");
  const canEditFinance = useCan("finance.edit");
  const access = usePayrollAccess();
  // F-09-086/094: «только текущий день» не даёт периода — только «Расчёт за день»
  const canView = access.calcAccess === "all";
  const canManage =
    canManagePayroll && canEditFinance && access.accrueAccess !== "none";

  const [range, setRange] = useState<DateRange>(() => ({
    from: toISODate(dayjs().startOf("month")),
    to: today(),
  }));
  const [positionKey, setPositionKey] = useState("");
  const [creatingId, setCreatingId] = useState<Id | "all" | null>(null);
  const from = range.from ?? toISODate(dayjs().startOf("month"));
  const to = range.to ?? today();

  const q = useApiQuery(
    ["payroll", "period", locationId, from, to, positionKey],
    () =>
      computePeriod(locationId!, from, to, {
        positionKey: positionKey || undefined,
      }),
    { enabled: ready && Boolean(locationId), keepPrevious: true },
  );
  const settingsQ = useApiQuery(
    ["payroll", "settings", locationId],
    () => getGeneralSettings(locationId!),
    { enabled: ready && Boolean(locationId) },
  );
  const closedThrough = settingsQ.data?.closedThrough;
  const staffQuery = useCoreList(
    "staff",
    { businessId },
    { enabled: ready && Boolean(businessId) },
  );
  const staffById = new Map((staffQuery.data ?? []).map((s) => [s.id, s]));

  // З20: должность — на языке интерфейса; ключ фильтра остаётся русским (так её ищет computePeriod)
  const positionOptions = [
    { value: "", label: t("period.allPositions") },
    ...Array.from(
      new Map(
        (staffQuery.data ?? [])
          .filter(
            (s) =>
              s.position &&
              s.status !== "fired" &&
              (!locationId || s.locationIds.includes(locationId)),
          )
          .map((s) => [
            s.position!.ru ?? s.position!.en ?? s.position!.hy ?? "",
            pickText(s.position, locale),
          ]),
      ),
    )
      .filter(([key]) => key)
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label })),
  ];

  // F-09-088/102: «только свой расчёт» — сотрудник не может видеть коллег ни в таблице, ни в итогах.
  const rows: Row[] = (q.data?.rows ?? [])
    .filter(
      (r) => !access.ownOnlyStaffId || r.staffId === access.ownOnlyStaffId,
    )
    .map((r) => {
      const staff = staffById.get(r.staffId);
      return {
        ...r,
        staffName: staff?.name ?? r.staffId,
        position: staff?.position ? pickText(staff.position, locale) : undefined,
      };
    });
  const totals = rows.reduce(
    (acc, r) => ({
      totalAmount: acc.totalAmount + r.totalAmount,
      paidAmount: acc.paidAmount + r.paidAmount,
      toPay: acc.toPay + toPayOf(r),
      bonuses: acc.bonuses + (r.breakdown?.bonuses ?? 0),
      penalties: acc.penalties + (r.breakdown?.penalties ?? 0),
      unpaidVisits: acc.unpaidVisits + (r.breakdown?.unpaidVisits ?? 0),
      unpaidAmount: acc.unpaidAmount + (r.breakdown?.unpaidAmount ?? 0),
    }),
    {
      totalAmount: 0,
      paidAmount: 0,
      toPay: 0,
      bonuses: 0,
      penalties: 0,
      unpaidVisits: 0,
      unpaidAmount: 0,
    },
  );
  // Постранично, как во всех списках (DESIGN.md → Long lists); итоги выше — по всем сотрудникам
  const { pageItems: rowsPage, pager } = usePagedList(rows, { resetKey: `${from}|${to}` });

  const periodFrom = `${from}T00:00`;
  const periodTo = `${to}T23:59`;
  const staffIdsKey = rows.map((r) => r.staffId).join(",");
  // F-09-063: для каждого сотрудника — уже есть ли ведомость за ВЫБРАННЫЙ период (точное совпадение
  // periodFrom/periodTo, как их пишет createSettlementSheet).
  const sheetsQuery = useApiQuery(
    ["payroll", "periodSheets", businessId, from, to, staffIdsKey],
    async () => {
      const ids = staffIdsKey ? staffIdsKey.split(",") : [];
      const lists = await Promise.all(
        ids.map((id) => listSettlementEntries(businessId!, id)),
      );
      const map = new Map<Id, SettlementEntry>();
      lists.forEach((entries, i) => {
        const found = entries.find(
          (e) =>
            e.kind === "sheet" &&
            e.periodFrom === periodFrom &&
            e.periodTo === periodTo,
        );
        if (found) map.set(ids[i], found);
      });
      return map;
    },
    { enabled: ready && Boolean(businessId) && rows.length > 0, keepPrevious: true },
  );
  const existingSheetFor = (staffId: Id) => sheetsQuery.data?.get(staffId);
  // ux-best-c1 §3 / c3 §3: главная кнопка говорит, что и сколько именно она начислит — вместе с премиями
  // и штрафами за период, они уже во взаиморасчётах (З7).
  const pendingRows = rows.filter((r) => !existingSheetFor(r.staffId));
  const pendingTotal = pendingRows.reduce((s, r) => s + toPayOf(r), 0);
  const pendingHasExtras = pendingRows.some(
    (r) => (r.breakdown?.bonuses ?? 0) > 0 || (r.breakdown?.penalties ?? 0) > 0,
  );

  // F-09-063: ссылка в строке создаёт ведомость за ВЫБРАННЫЙ период этому сотруднику и открывает её;
  // если ведомость за этот период уже создана — просто открываем её (без повторного начисления).
  const sheetsData = sheetsQuery.data;
  const createSheetFor = useCallback(
    async (staffId: Id) => {
      if (!businessId) return;
      const href = `/biz/payroll/statement?staffId=${staffId}&from=${from}&to=${to}`;
      if (sheetsData?.get(staffId)) {
        router.push(href);
        return;
      }
      setCreatingId(staffId);
      try {
        await createSettlementSheet(businessId, staffId, periodFrom, periodTo);
        toast.success(t("period.sheetCreated"));
        router.push(href);
      } catch {
        toast.error(t("period.sheetCreateFailed"));
      } finally {
        setCreatingId(null);
      }
    },
    [businessId, from, to, periodFrom, periodTo, sheetsData, router, toast, t],
  );

  const createSheetForAll = async () => {
    if (!businessId || pendingRows.length === 0) return;
    setCreatingId("all");
    try {
      await Promise.all(
        pendingRows.map((r) =>
          createSettlementSheet(businessId, r.staffId, periodFrom, periodTo),
        ),
      );
      toast.success(t("period.sheetCreatedAll", { count: pendingRows.length }));
    } catch {
      toast.error(t("period.sheetCreateFailed"));
    } finally {
      setCreatingId(null);
    }
  };

  const closeM = useApiMutation((through: string) =>
    closePayrollPeriod(locationId!, through),
  );
  const handleClosePeriod = async () => {
    const date = dayjs(to).format("DD.MM.YYYY");
    const ok = await confirm({
      title: t("period.closePeriodTitle", { date }),
      description: t("period.closePeriodText", { date }),
      confirmLabel: t("period.closePeriod"),
    });
    if (!ok) return;
    try {
      await closeM.mutate(to);
      toast.success(t("period.periodClosed"));
    } catch {
      toast.error(t("period.closeFailed"));
    }
  };

  // З19: заголовки по смыслу колонок; рабочие дни и часы по графику раздельно; число услуг, премии, штрафы
  const handleExport = () => {
    const csvRows = rows.map((r) => [
      r.staffName,
      r.position ?? "",
      String(r.workDays),
      duration(Math.round(r.workHours * 60)),
      String(r.servicesCount),
      money(r.servicesAmount),
      money(r.productsAmount),
      money(r.totalAmount),
      money(r.paidAmount),
      money(r.salary),
      money(r.breakdown?.bonuses ?? 0),
      money(r.breakdown?.penalties ?? 0),
      money(toPayOf(r)),
    ]);
    const csv = toCsv(csvRows, [
      t("period.columns.staff"),
      t("period.columns.position"),
      t("period.columns.workDays"),
      t("period.columns.workHours"),
      t("period.columns.servicesCount"),
      t("period.columns.servicesAmount"),
      t("period.columns.productsAmount"),
      t("period.columns.totalAmount"),
      t("period.columns.paidAmount"),
      t("period.columns.salary"),
      t("period.columns.bonuses"),
      t("period.columns.penalties"),
      t("period.columns.toPay"),
    ]);
    downloadCsv(`payroll-period-${from}-${to}.csv`, csv);
  };

  const accrueAllLabel =
    rows.length > 0 && pendingRows.length === 0
      ? t("period.sheetAlreadyExistsAll")
      : t("period.accrueAllLabel", { count: pendingRows.length, amount: money(pendingTotal) });

  const menuItems: DropdownMenuItem[] = [
    {
      id: "export",
      label: t("period.exportExcel"),
      icon: <FileDown aria-hidden />,
      disabled: rows.length === 0,
      onSelect: handleExport,
    },
    {
      id: "settlements",
      label: t("period.columns.settlementsLink"),
      icon: <ArrowRightLeft aria-hidden />,
      href: "/biz/payroll/settlements",
    },
    ...(canManage
      ? [
          {
            id: "close",
            label: t("period.closePeriod"),
            icon: <LockKeyhole aria-hidden />,
            disabled: Boolean(closedThrough && closedThrough >= to),
            onSelect: () => void handleClosePeriod(),
          } satisfies DropdownMenuItem,
        ]
      : []),
  ];

  const loading = !ready || q.isLoading;

  return (
    <div
      data-f="F-09-062 F-09-017 F-09-026 F-09-106 F-09-111 F-09-112 F-09-063 F-09-064 F-09-065 F-09-088 F-09-102"
      className="flex flex-col gap-6"
    >
      <PageHeader title={t("nav.period")} description={t("period.subtitle")} />

      {access.ready && !canView ? (
        <EmptyState
          icon={<Lock aria-hidden className="size-8 text-muted" />}
          title={t("access.deniedHint")}
          description={t("me.todayOnly")}
        />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : !loading && !q.data?.anyConfigured ? (
        <PayrollNotConfigured />
      ) : (
        <>
          <FilterBar
            filters={[
              {
                id: "range",
                label: t("period.rangeLabel"),
                primary: true,
                node: <DateRangePicker value={range} onValueChange={setRange} max={today()} presets />,
              },
              {
                id: "position",
                label: t("period.positionFilter"),
                node: (
                  <Select
                    options={positionOptions}
                    value={positionKey}
                    onValueChange={setPositionKey}
                    aria-label={t("period.positionFilter")}
                  />
                ),
              },
            ]}
            actions={
              <>
                <DropdownMenu
                  label={t("period.moreActions")}
                  align="end"
                  trigger={(p) => <IconButton {...p} icon={<MoreHorizontal aria-hidden />} label={t("period.moreActions")} variant="outline" />}
                  items={menuItems}
                />
                {canManage && (
                  <Button
                    loading={creatingId === "all"}
                    disabled={loading || creatingId !== null || pendingRows.length === 0}
                    onClick={createSheetForAll}
                    title={pendingHasExtras ? t("period.accrueAllExtras") : undefined}
                  >
                    {/* Надпись из данных («· 7 сотрудников · 177 800 ֏») — при загрузке полоса типичной ширины */}
                    {loading ? <SkeletonText width="37ch" className="max-w-none" /> : accrueAllLabel}
                  </Button>
                )}
              </>
            }
          />

          {closedThrough && (
            <div className="flex items-center gap-2">
              <Badge tone="neutral">
                <LockKeyhole aria-hidden className="mr-1 inline size-3.5" />
                {t("period.closedThrough", { date: dayjs(closedThrough).format("DD.MM.YYYY") })}
              </Badge>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              loading={loading}
              label={t("period.totalToPay")}
              value={money(totals.toPay)}
              hint={
                loading
                  ? " "
                  : totals.bonuses > 0 || totals.penalties > 0
                  ? t("period.toPayHint", { bonuses: money(totals.bonuses), penalties: money(totals.penalties) })
                  : undefined
              }
              icon={<Wallet aria-hidden />}
              className="col-span-2 sm:col-span-1"
            />
            <StatCard loading={loading} label={t("period.totalRevenue")} value={money(totals.totalAmount)} />
            <StatCard
              loading={loading}
              label={t("period.totalPaidToRegister")}
              value={money(totals.paidAmount)}
              hint={t("period.paidHint")}
              keepHint
            />
          </div>

          {/* Неоплаченные визиты в демо есть почти всегда — при загрузке плашка уже на месте, текст полосой */}
          {(loading || totals.unpaidVisits > 0) && (
            <div
              data-f="F-09-006"
              className="flex flex-wrap items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2.5 text-sm text-fg"
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              <span className="min-w-0 flex-1">
                {loading ? (
                  // На телефоне фраза «Не оплачено N визитов на сумму …» — в четыре строки рядом со ссылкой
                  <>
                    <span className="block md:hidden">
                      <Skeleton lines={4} />
                    </span>
                    <span className="hidden md:inline">
                      <SkeletonText width="48ch" />
                    </span>
                  </>
                ) : t("period.unpaidNotice", {
                  count: totals.unpaidVisits,
                  amount: money(totals.unpaidAmount),
                })}
              </span>
              <Link href="/biz/records" className="font-medium text-primary-text hover:underline">
                {t("period.unpaidLink")}
              </Link>
            </div>
          )}

          <Reveal
            loading={loading}
            skeleton={
              <ul className="flex flex-col gap-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <PeriodStaffCardSkeleton key={i} canManage={canManage} />
                ))}
              </ul>
            }
          >
            {rows.length === 0 ? (
              <EmptyState icon={<Wallet aria-hidden />} title={t("period.empty")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {rowsPage.map((r) => (
                  <PeriodStaffCard
                    key={r.staffId}
                    row={r}
                    canManage={canManage}
                    existingCreatedAt={existingSheetFor(r.staffId)?.createdAt}
                    statementHref={`/biz/payroll/statement?staffId=${r.staffId}&from=${from}&to=${to}`}
                    creating={creatingId === r.staffId}
                    actionDisabled={creatingId !== null || sheetsQuery.isLoading}
                    onCreateSheet={createSheetFor}
                  />
                ))}
              </ul>
            )}
            {pager && <div className="mt-4">{pager}</div>}
          </Reveal>
        </>
      )}
    </div>
  );
}
