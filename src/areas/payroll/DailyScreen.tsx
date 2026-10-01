"use client";

/**
 * /biz/payroll/daily — «Расчёт за день» (F-09-058, F-09-059, F-09-061). Принадлежит разделу «payroll».
 * «Создать ведомость» (F-09-060) и выгрузка в Excel (F-09-065) зовут общую api-функцию finance
 * (createSettlementSheet, F-07-162 = F-09-063; CONVENTIONS §6 — используем чужой api как контракт).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, FileDown } from "lucide-react";
import { computeDay } from "@/api/payroll";
import { createSettlementSheet, listSettlementEntries } from "@/api/finance";
import { useApiQuery } from "@/api/request";
import { useCoreList } from "@/api/core";
import type { Id } from "@/domain/core";
import type { SettlementEntry } from "@/domain/finance";
import { useCan, useCurrent } from "@/demo/hooks";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { dayjs, today } from "@/lib/date";
import { downloadCsv, toCsv } from "@/lib/csv";
import { Badge } from "@/ui/Badge";
import { SkeletonText } from "@/ui/Skeleton";
import { Button } from "@/ui/Button";
import { DatePicker } from "@/ui/DatePicker";
import { ErrorState } from "@/ui/ErrorState";
import { PageHeader } from "@/ui/PageHeader";
import { Popover } from "@/ui/Popover";
import { DropdownChevron } from "@/ui/DropdownChevron";
import { Table, type TableColumn } from "@/ui/Table";
import { useToast } from "@/ui/Toast";
import { Lock } from "lucide-react";
import { PayrollNotConfigured } from "@/areas/payroll/shared/PayrollNotConfigured";
import { isDateAllowed, usePayrollAccess } from "@/areas/payroll/access";
import { EmptyState } from "@/ui/EmptyState";
import type { StaffDayResult } from "@/domain/payroll";

interface Row {
  staffId: Id;
  staffName: string;
  result: StaffDayResult;
}

export function DailyScreen() {
  const t = useT("payroll");
  const { money } = useFormat();
  const toast = useToast();
  const router = useRouter();
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
  // F-09-086/087: базовое право фундамента + наше сужение по сотруднику (schemesAccess не участвует здесь)
  const canView = access.calcAccess !== "none";
  const canManage =
    canManagePayroll && canEditFinance && access.accrueAccess !== "none";
  const [date, setDate] = useState(today());
  const [creatingId, setCreatingId] = useState<Id | "all" | null>(null);
  // F-09-086/094: «только текущий день» — календарь заперт на сегодня
  if (access.ready && access.calcAccess === "today" && date !== today())
    setDate(today());

  const q = useApiQuery(
    ["payroll", "day", locationId, date],
    () => computeDay(locationId!, date),
    {
      enabled: ready && Boolean(locationId),
      keepPrevious: true,
    },
  );
  const staffQuery = useCoreList(
    "staff",
    { businessId },
    { enabled: ready && Boolean(businessId) },
  );
  const staffById = new Map((staffQuery.data ?? []).map((s) => [s.id, s]));

  // F-09-088/102: «только свой расчёт» — сотрудник не видит коллег и здесь, не только в /period.
  const rows: Row[] = (q.data?.staff ?? [])
    .filter(
      (r) => !access.ownOnlyStaffId || r.staffId === access.ownOnlyStaffId,
    )
    .map((r) => ({
      staffId: r.staffId,
      staffName: staffById.get(r.staffId)?.name ?? r.staffId,
      result: r,
    }));
  const dayTotal = rows.reduce((sum, r) => sum + r.result.total, 0);

  const staffIdsKey = rows.map((r) => r.staffId).join(",");
  const periodFrom = `${date}T00:00`;
  const periodTo = `${date}T23:59`;
  // F-09-060: для каждого сотрудника — уже есть ли ведомость ЗА ЭТОТ ДЕНЬ (F-07-162 создаёт sheet-запись
  // с periodFrom/periodTo, а не отдельным флагом «day» — сверяем по точному совпадению периода).
  const sheetsQuery = useApiQuery(
    ["payroll", "daySheets", businessId, date, staffIdsKey],
    async () => {
      const lists = await Promise.all(
        rows.map((r) => listSettlementEntries(businessId!, r.staffId)),
      );
      const map = new Map<Id, SettlementEntry>();
      lists.forEach((entries, i) => {
        const found = entries.find(
          (e) =>
            e.kind === "sheet" &&
            e.periodFrom === periodFrom &&
            e.periodTo === periodTo,
        );
        if (found) map.set(rows[i].staffId, found);
      });
      return map;
    },
    { enabled: ready && Boolean(businessId) && rows.length > 0 },
  );
  const existingSheetFor = (staffId: Id) => sheetsQuery.data?.get(staffId);

  // F-09-060: ссылка/кнопка у сотрудника создаёт ведомость за ЭТОТ день и сразу открывает её страницу;
  // если ведомость за этот день уже создана — просто открываем её (без повторного начисления).
  const createSheetFor = async (staffId: Id) => {
    if (!businessId) return;
    const already = existingSheetFor(staffId);
    if (already) {
      router.push(
        `/biz/payroll/statement?staffId=${staffId}&from=${date}&to=${date}`,
      );
      return;
    }
    setCreatingId(staffId);
    try {
      await createSettlementSheet(businessId, staffId, periodFrom, periodTo);
      toast.success(t("daily.sheetCreated"));
      router.push(
        `/biz/payroll/statement?staffId=${staffId}&from=${date}&to=${date}`,
      );
    } catch {
      toast.error(t("daily.sheetCreateFailed"));
    } finally {
      setCreatingId(null);
    }
  };

  const createSheetForAll = async () => {
    if (!businessId || rows.length === 0) return;
    const pending = rows.filter((r) => !existingSheetFor(r.staffId));
    if (pending.length === 0) {
      toast.info(t("daily.sheetAlreadyExistsAll"));
      return;
    }
    setCreatingId("all");
    try {
      await Promise.all(
        pending.map((r) =>
          createSettlementSheet(businessId, r.staffId, periodFrom, periodTo),
        ),
      );
      toast.success(t("daily.sheetCreatedAll", { count: pending.length }));
    } catch {
      toast.error(t("daily.sheetCreateFailed"));
    } finally {
      setCreatingId(null);
    }
  };

  // F-09-065: выгрузка того, что показано на экране — те же строки и суммы.
  const handleExport = () => {
    const csvRows = rows.map((r) => [
      r.staffName,
      money(r.result.servicesAmount),
      money(r.result.productsAmount),
      money(r.result.workdayAmount),
      money(r.result.recordsAmount),
      money(r.result.extraAmount),
      money(r.result.total),
    ]);
    const csv = toCsv(csvRows, [
      t("daily.columns.staff"),
      t("scheme.blocks.personalServices.short"),
      t("scheme.blocks.productSales.short"),
      t("scheme.blocks.workday.short"),
      t("scheme.blocks.records.short"),
      t("scheme.blocks.extraRevenue.services.short"),
      t("daily.columns.total"),
    ]);
    downloadCsv(`payroll-day-${date}.csv`, csv);
  };

  const loading = !ready || q.isLoading;

  const columns: TableColumn<Row>[] = [
    {
      id: "staff",
      header: t("daily.columns.staff"),
      cell: (r) => <span className="block truncate">{r.staffName}</span>,
      mobile: "title",
      width: "14rem",
      skeletonWidth: "14ch",
    },
    {
      id: "operations",
      header: t("daily.columns.operations"),
      cell: (r) => (
        <div className="flex flex-wrap gap-1.5">
          {r.result.operations.map((op, i) => (
            <Popover
              key={i}
              trigger={(p) => (
                <button
                  type="button"
                  {...p}
                  className="flex min-h-10 items-center gap-1 rounded-md bg-surface-2 px-2.5 py-1.5 text-sm whitespace-nowrap text-fg hover:bg-surface-3"
                >
                  {op.time} · {money(op.amount)}
                  {/* З17: у каждого чипа, открывающего раскладку, — стрелка (DESIGN.md → «Выпадающие») */}
                  <DropdownChevron open={Boolean(p["aria-expanded"])} />
                </button>
              )}
            >
              <div data-f="F-09-059" className="flex flex-col gap-1.5 p-3">
                <p className="mb-1 text-sm font-medium text-fg">
                  {t("daily.breakdownTitle")}
                </p>
                {op.lines.map((line, li) => (
                  <div key={li} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted">
                        {line.refId.startsWith("commission:")
                          ? t("daily.commissionLine")
                          : line.label}
                      </span>
                      <span className="font-medium text-fg">
                        {money(line.amount)}
                      </span>
                    </div>
                    {line.clippedByConsumables && (
                      <span className="text-xs text-warning">
                        {t("daily.clippedByConsumables")}
                      </span>
                    )}
                    {line.unpaid ? (
                      <span className="text-xs text-warning">
                        {t("statement.unpaidLine")}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </Popover>
          ))}
        </div>
      ),
      // Операций у строки может не быть (администратор с оплатой за день) — полоса текста, не чип
      skeletonWidth: "13ch",
    },
    {
      id: "total",
      header: t("daily.columns.total"),
      cell: (r) => (
        <span className="font-semibold text-fg">{money(r.result.total)}</span>
      ),
      align: "right",
      mobile: "aside",
      width: "9rem",
      skeletonWidth: "9ch",
    },
    ...(canManage
      ? [
          {
            id: "sheet",
            header: t("daily.columns.settlements"),
            cell: (r: Row) => {
              const existing = existingSheetFor(r.staffId);
              if (existing) {
                return (
                  <Link
                    href={`/biz/payroll/statement?staffId=${r.staffId}&from=${date}&to=${date}`}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary-text hover:underline"
                  >
                    <CheckCircle2 aria-hidden className="size-4" />
                    {dayjs(existing.createdAt).format("DD.MM")}
                  </Link>
                );
              }
              return (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={creatingId === r.staffId}
                  disabled={creatingId !== null || sheetsQuery.isLoading}
                  onClick={() => createSheetFor(r.staffId)}
                >
                  {t("daily.createSheet")}
                </Button>
              );
            },
            align: "right" as const,
            mobile: "aside" as const,
            width: "11rem",
            skeleton: (
              <Button size="sm" variant="ghost" disabled>
                {t("daily.createSheet")}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div
      data-f="F-09-058 F-09-017 F-09-026 F-09-106 F-09-111 F-09-112 F-09-060 F-09-065 F-09-088 F-09-102 F-09-006 F-09-081 F-09-113"
      className="flex flex-col gap-6"
    >
      <PageHeader
        title={t("nav.daily")}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
            <DatePicker
              className="w-auto shrink-0"
              value={date}
              onValueChange={(d) =>
                d && isDateAllowed(access.calcAccess, d) && setDate(d)
              }
              max={today()}
              min={access.calcAccess === "today" ? today() : undefined}
              disabled={access.calcAccess === "today"}
            />
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0 whitespace-nowrap"
              leftIcon={<FileDown aria-hidden className="size-4" />}
              onClick={handleExport}
              disabled={rows.length === 0}
            >
              {t("daily.exportExcel")}
            </Button>
            {canManage && (loading || rows.length > 0) && (
              <Button
                size="sm"
                className="shrink-0 whitespace-nowrap"
                loading={creatingId === "all"}
                disabled={loading || creatingId !== null}
                onClick={createSheetForAll}
              >
                {t("daily.createSheetAll")}
              </Button>
            )}
          </div>
        }
      />

      {access.ready && !canView ? (
        <EmptyState
          icon={<Lock aria-hidden className="size-8 text-muted" />}
          title={t("access.deniedHint")}
        />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : !loading && !q.data?.anyConfigured ? (
        <PayrollNotConfigured />
      ) : (
        <>
          <Table
            loading={loading}
            // За один день в демо — один-два мастера с операциями
            loadingRows={1}
            columns={columns}
            rows={rows}
            rowKey={(r) => r.staffId}
            empty={<span className="text-muted">{t("daily.emptyDay")}</span>}
          />
          {(loading || rows.length > 0) && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2/50 px-4 py-3">
              <span className="font-medium text-fg">{t("daily.dayTotal")}</span>
              <Badge tone="primary" size="md">
                {loading ? <SkeletonText width="6ch" /> : money(dayTotal)}
              </Badge>
            </div>
          )}
        </>
      )}
    </div>
  );
}
