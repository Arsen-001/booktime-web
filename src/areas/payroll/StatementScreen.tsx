"use client";

/**
 * /biz/payroll/statement?staffId=&from=&to= — «Расчётная ведомость» (F-09-067): из чего сложилась
 * зарплата сотрудника за период — визит за визитом, с ценой и выплатой. Принадлежит разделу «payroll».
 *
 * Данные о самом начислении (когда создано, сумма «Приход», премии/штрафы, выплата, удаление) живут во
 * «Взаиморасчётах» — общем экране finance (F-07-159…162, src/areas/finance/SettlementsScreen.tsx);
 * здесь используем его api-функции как публичный контракт (CONVENTIONS §6), не правим чужой файл.
 * «Себестоимость» и «Способ оплаты» из справки (1272) не выгружаем: техкарта себестоимости и разбивка
 * оплаты по кассам ещё не отданы разделами stock/finance (см. qa/requests/payroll.md) — колонка
 * «Выплата vs Стоимость» показывает то же самое отличие (ставка и списание расходников), без выдумывания
 * чисел, которых у нас нет.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Gift,
  Minus,
  RefreshCw,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  advanceStatementApproval,
  getGeneralSettings,
  getScheme,
  getStatementApproval,
  computeStatement,
  listBonusPenaltyTypes,
  signStatement,
} from "@/api/payroll";
import {
  accrueSettlementSheet,
  createSettlementEntry,
  createSettlementSheet,
  deleteSettlementEntry,
  listSettlementEntries,
} from "@/api/finance";
import { useCoreList } from "@/api/core";
import { useApiMutation, useApiQuery } from "@/api/request";
import {
  nextApprovalStatus,
  type BonusPenaltyType,
  type StatementApprovalStatus,
} from "@/domain/payroll";
import type { SettlementEntryKind } from "@/domain/finance";
import { useCan, useCurrent } from "@/demo/hooks";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { downloadCsv, toCsv } from "@/lib/csv";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { IconButton } from "@/ui/IconButton";
import { Modal } from "@/ui/Modal";
import { MoneyInput } from "@/ui/MoneyInput";
import { formatDateRange } from "@/ui/DateRangePicker";
import { PageHeader } from "@/ui/PageHeader";
import { usePagedList } from "@/ui/Pagination";
import { SectionCard } from "@/ui/SectionCard";
import { Select } from "@/ui/Select";
import { Skeleton, SkeletonList } from "@/ui/Skeleton";
import { Reveal } from "@/ui/Reveal";
import { PayBreakdownList } from "@/areas/payroll/shared/PayBreakdownList";
import { StatCard } from "@/ui/StatCard";
import { Textarea } from "@/ui/Textarea";
import { useConfirm, useToast } from "@/ui/Toast";

export function StatementScreen() {
  const t = useT("payroll");
  // F-09-007/107: строка удержания комиссии банка — служебный refId, не сырой текст на экране
  const lineLabel = (line: { refId: string; label: string }) =>
    line.refId.startsWith("commission:")
      ? t("daily.commissionLine")
      : line.label;
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const search = useSearchParams();
  const staffId = search.get("staffId") ?? undefined;
  const from = search.get("from") ?? undefined;
  const to = search.get("to") ?? undefined;

  const {
    ready,
    businessId,
    staffId: myStaffId,
    persona,
    locationId: currentLocationId,
    activeLocationIds,
  } = useCurrent();
  const locationId =
    currentLocationId === "all" ? activeLocationIds[0] : currentLocationId;
  // F-09-068/071: сами начисление и удаление — операции finance (assertCan('finance.edit') внутри
  // createSettlementEntry/deleteSettlementEntry, чужой файл) — прав payroll.manage одних недостаточно,
  // поэтому кнопки показываем только когда есть оба права (иначе пользователь видел бы кнопку, которая
  // всегда падает тостом «не удалось»).
  const canManagePayroll = useCan("payroll.manage");
  const canEditFinance = useCan("finance.edit");
  const canManage = canManagePayroll && canEditFinance;

  const staffQuery = useCoreList(
    "staff",
    { businessId },
    { enabled: ready && Boolean(businessId) },
  );
  const staff = (staffQuery.data ?? []).find((s) => s.id === staffId);

  const statementQ = useApiQuery(
    ["payroll", "statement", locationId, staffId, from, to],
    () => computeStatement(locationId!, staffId!, from!, to!),
    {
      enabled:
        ready &&
        Boolean(locationId) &&
        Boolean(staffId) &&
        Boolean(from) &&
        Boolean(to),
    },
  );
  const entriesQ = useApiQuery(
    ["finance", "settlements", businessId, staffId],
    () => listSettlementEntries(businessId!, staffId!),
    { enabled: ready && Boolean(businessId) && Boolean(staffId) },
  );
  const bookingsQ = useCoreList(
    "bookings",
    { staffId: staffId ?? "" },
    { enabled: ready && Boolean(staffId) },
  );
  const bonusTypesQ = useApiQuery(
    ["payroll", "bonusPenaltyTypes", businessId, "bonus"],
    () => listBonusPenaltyTypes(businessId!, "bonus"),
    { enabled: ready && Boolean(businessId) },
  );
  const penaltyTypesQ = useApiQuery(
    ["payroll", "bonusPenaltyTypes", businessId, "penalty"],
    () => listBonusPenaltyTypes(businessId!, "penalty"),
    { enabled: ready && Boolean(businessId) },
  );
  const schemeQ = useApiQuery(
    ["payroll", "scheme", staffId],
    () => getScheme(staffId!),
    { enabled: ready && Boolean(staffId) },
  );
  const settingsQ = useApiQuery(
    ["payroll", "settings", locationId],
    () => getGeneralSettings(locationId!),
    { enabled: ready && Boolean(locationId) },
  );

  // Ведомость этого периода во взаиморасчётах (F-09-063/066: sheet-запись finance с тем же periodFrom/periodTo) —
  // нужна для «когда начислено» (подсветка F-09-070) и «Удалить» (F-09-071).
  const sheet = useMemo(() => {
    if (!entriesQ.data || !from || !to) return undefined;
    return entriesQ.data.find(
      (e) =>
        e.kind === "sheet" &&
        e.periodFrom?.slice(0, 10) === from &&
        e.periodTo?.slice(0, 10) === to,
    );
  }, [entriesQ.data, from, to]);
  const periodEntries = useMemo(() => {
    if (!entriesQ.data || !from || !to) return [];
    return entriesQ.data.filter(
      (e) =>
        e.kind !== "sheet" &&
        e.kind !== "payout" &&
        e.createdAt.slice(0, 10) >= from &&
        e.createdAt.slice(0, 10) <= to,
    );
  }, [entriesQ.data, from, to]);
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: operationsPage, pager: operationsPager } = usePagedList(statementQ.data?.operations ?? []);
  const { pageItems: entriesPage, pager: entriesPager } = usePagedList(periodEntries);
  const bookingById = useMemo(
    () => new Map((bookingsQ.data ?? []).map((b) => [b.id, b])),
    [bookingsQ.data],
  );
  // F-09-100: согласование ведомости — только когда владелец включил это в «Основных настройках»
  const approvalEnabled = Boolean(settingsQ.data?.statementApprovalEnabled);
  // Не `sheet!.id`: React Compiler по «!» считает sheet не-null и выносит чтение поля в рендер.
  const approvalQ = useApiQuery(
    ["payroll", "statementApproval", sheet?.id],
    () => getStatementApproval(sheet?.id ?? ""),
    { enabled: Boolean(sheet) && approvalEnabled },
  );
  const advanceM = useApiMutation((id: string) =>
    advanceStatementApproval(id, myStaffId),
  );
  const signM = useApiMutation((id: string) => signStatement(id, myStaffId!));
  const approvalStatus: StatementApprovalStatus =
    approvalQ.data?.status ?? "pendingReview";
  const approvalNext = nextApprovalStatus(approvalStatus);
  const isOwnStatement = persona === "master" && myStaffId === staffId;
  const handleAdvance = async () => {
    if (!sheet) return;
    try {
      await advanceM.mutate(sheet.id);
      toast.success(t("statement.approval.advanced"));
      approvalQ.refetch();
    } catch {
      toast.error(t("statement.actionFailed"));
    }
  };
  const handleSign = async () => {
    if (!sheet) return;
    try {
      await signM.mutate(sheet.id);
      toast.success(t("statement.approval.signed"));
      approvalQ.refetch();
    } catch {
      toast.error(t("statement.actionFailed"));
    }
  };
  // F-09-070: жёлтая подсветка ведомости целиком — ставку в схеме поменяли ПОСЛЕ начисления (в отличие
  // от красной — она про конкретный визит, эта про схему сотрудника).
  const schemeChangedAfterSheet = Boolean(
    sheet && schemeQ.data && schemeQ.data.updatedAt > sheet.createdAt,
  );

  const bonusesTotal = periodEntries
    .filter((e) => e.kind === "bonus" || e.kind === "adjustment")
    .reduce((s, e) => s + e.amount, 0);
  const penaltiesTotal = periodEntries
    .filter((e) => e.kind === "penalty")
    .reduce((s, e) => s + e.amount, 0);
  // З2: «К выплате» — та же раскладка, что «Расчёт за период» (зарплата по схеме + премии − штрафы), а не
  // только услуги; без раскладки (ответ сервера в режиме api) — прежняя сумма услуг с премиями.
  const breakdown = statementQ.data?.breakdown;
  const grandTotal =
    breakdown?.toPay ??
    (statementQ.data?.total ?? 0) + bonusesTotal - penaltiesTotal;
  // З11: период закрыт — ведомость не пересчитывается, разница уходит корректировкой в текущий период
  const closedThrough = settingsQ.data?.closedThrough;
  const periodClosed = Boolean(closedThrough && to && to <= closedThrough);
  const correctionLabel =
    from && to
      ? t("statement.correctionLabel", {
          period: formatDateRange(format, { from, to }) ?? `${from}–${to}`,
        })
      : "";
  // Уже начисленные корректировки за этот период (могут лежать в следующем периоде) — не начислять дважды
  const correctedSum = (entriesQ.data ?? [])
    .filter((e) => e.label === correctionLabel)
    .reduce((s, e) => s + (e.kind === "penalty" ? -e.amount : e.amount), 0);
  const difference =
    sheet && breakdown
      ? Math.round((breakdown.salary - sheet.amount - correctedSum) * 100) / 100
      : 0;
  const [correcting, setCorrecting] = useState(false);
  const handleCorrection = async () => {
    if (!businessId || !staffId || !from || !to || difference === 0) return;
    setCorrecting(true);
    try {
      const label = correctionLabel;
      await createSettlementEntry(
        businessId,
        staffId,
        difference > 0 ? "adjustment" : "penalty",
        label,
        Math.abs(difference),
      );
      toast.success(t("statement.correctionDone"));
    } catch {
      toast.error(t("statement.actionFailed"));
    } finally {
      setCorrecting(false);
    }
  };

  const [entryOpen, setEntryOpen] = useState<Extract<
    SettlementEntryKind,
    "bonus" | "penalty"
  > | null>(null);
  const [typeId, setTypeId] = useState<string | undefined>(undefined);
  const [entryAmount, setEntryAmount] = useState<number | undefined>(undefined);
  const [entryComment, setEntryComment] = useState("");
  const entryM = useApiMutation(
    (args: {
      kind: "bonus" | "penalty";
      label: string;
      amount: number;
      comment: string;
    }) =>
      createSettlementEntry(
        businessId!,
        staffId!,
        args.kind,
        args.label,
        args.amount,
        args.comment,
      ),
  );
  const deleteEntryM = useApiMutation((id: string) =>
    deleteSettlementEntry(businessId!, id),
  );
  const deleteSheetM = useApiMutation((id: string) =>
    deleteSettlementEntry(businessId!, id),
  );
  // F-09-069: ведомость-черновик не в балансе — «Начислить» переводит её в начисленную
  const accrueSheetM = useApiMutation((id: string) =>
    accrueSettlementSheet(businessId!, id),
  );
  const handleAccrueSheet = async () => {
    if (!sheet) return;
    try {
      await accrueSheetM.mutate(sheet.id);
      toast.success(t("statement.accrued"));
      entriesQ.refetch();
    } catch {
      toast.error(t("statement.actionFailed"));
    }
  };

  const typeOptions =
    (entryOpen === "bonus" ? bonusTypesQ.data : penaltyTypesQ.data) ?? [];

  const openEntry = (kind: "bonus" | "penalty") => {
    setEntryOpen(kind);
    setTypeId(undefined);
    setEntryAmount(undefined);
    setEntryComment("");
  };

  const pickType = (id: string) => {
    setTypeId(id);
    const type = typeOptions.find((tt: BonusPenaltyType) => tt.id === id);
    if (type) setEntryAmount(type.defaultAmount);
  };

  const handleEntrySave = async () => {
    if (!entryOpen || !entryAmount || entryAmount <= 0) return;
    const type = typeOptions.find((tt: BonusPenaltyType) => tt.id === typeId);
    const label = type ? type.name : t(`statement.entry.${entryOpen}`);
    try {
      await entryM.mutate({
        kind: entryOpen,
        label,
        amount: entryAmount,
        comment: entryComment.trim(),
      });
      toast.success(t("statement.entryAdded"));
      setEntryOpen(null);
      entriesQ.refetch();
    } catch {
      toast.error(t("statement.actionFailed"));
    }
  };

  const handleDeleteEntry = async (id: string) => {
    const ok = await confirm({
      title: t("statement.deleteEntryTitle"),
      tone: "danger",
      confirmLabel: t("statement.deleteConfirm"),
    });
    if (!ok) return;
    try {
      await deleteEntryM.mutate(id);
      toast.success(t("statement.deleted"));
      entriesQ.refetch();
    } catch {
      toast.error(t("statement.actionFailed"));
    }
  };

  const handleDeleteSheet = async () => {
    if (!sheet) return;
    const ok = await confirm({
      title: t("statement.deleteSheetTitle"),
      description: t("statement.deleteSheetText"),
      tone: "danger",
      confirmLabel: t("statement.deleteConfirm"),
    });
    if (!ok) return;
    try {
      await deleteSheetM.mutate(sheet.id);
      toast.success(t("statement.deleted"));
      entriesQ.refetch();
    } catch {
      toast.error(t("statement.actionFailed"));
    }
  };

  const [recalculating, setRecalculating] = useState(false);
  // F-09-070: «Пересчитать и начислить» — снимает подсветку и обновляет сумму: удаляет старую
  // sheet-запись и создаёт новую за тот же период (данные пересчитываются заново из текущих визитов и схемы).
  const handleRecalculate = async () => {
    if (!sheet || !businessId || !staffId || !from || !to || periodClosed) return;
    const ok = await confirm({
      title: t("statement.recalculateConfirmTitle"),
      description: t("statement.recalculateConfirmText"),
      confirmLabel: t("statement.recalculate"),
    });
    if (!ok) return;
    setRecalculating(true);
    try {
      await deleteSettlementEntry(businessId, sheet.id);
      await createSettlementSheet(
        businessId,
        staffId,
        `${from}T00:00`,
        `${to}T23:59`,
        sheet.comment,
      );
      toast.success(t("statement.recalculated"));
      entriesQ.refetch();
      statementQ.refetch();
    } catch {
      toast.error(t("statement.recalculateFailed"));
    } finally {
      setRecalculating(false);
    }
  };

  const handleExport = () => {
    if (!statementQ.data) return;
    const rows = statementQ.data.operations.flatMap((op) =>
      op.lines.map((line) => [
        op.date,
        op.time,
        lineLabel(line),
        format.money(line.revenue),
        format.money(line.amount),
      ]),
    );
    const csv = toCsv(rows, [
      t("statement.export.date"),
      t("statement.export.time"),
      t("statement.export.item"),
      t("statement.export.revenue"),
      t("statement.export.payout"),
    ]);
    downloadCsv(`statement-${staffId}-${from}-${to}.csv`, csv);
  };

  if (!staffId || !from || !to) {
    return (
      <div className="flex w-full flex-col gap-6">
        <PageHeader title={t("statement.title")} />
        <EmptyState
          icon={<AlertTriangle aria-hidden className="size-8" />}
          title={t("statement.noParams")}
        />
      </div>
    );
  }

  return (
    <div
      data-f="F-09-067 F-09-068 F-09-070 F-09-071 F-09-006 F-09-081 F-09-113 F-09-076"
      className="flex w-full flex-col gap-6"
    >
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={staff?.name ?? "?"} size="md" />
            {staff?.name ?? t("statement.title")}
          </span>
        }
        description={formatDateRange(format, { from, to }) ?? undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleExport}
              disabled={
                !statementQ.data || statementQ.data.operations.length === 0
              }
            >
              {t("statement.exportExcel")}
            </Button>
            <Link
              href={`/biz/payroll/settlements?staffId=${staffId}`}
              className="inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-fg hover:bg-surface-3"
            >
              <ArrowLeft aria-hidden className="mr-1.5 size-4" />
              {t("statement.toSettlements")}
            </Link>
          </div>
        }
      />

      {statementQ.isError ? (
        <ErrorState onRetry={statementQ.refetch} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <StatCard
              loading={!ready || statementQ.isLoading || entriesQ.isLoading}
              label={t("statement.toPay")}
              value={format.money(grandTotal)}
              hint={
                sheet
                  ? `${t("statement.sheetAmount")}: ${format.money(sheet.amount)}`
                  : undefined
              }
              icon={<Wallet aria-hidden />}
            />
            <SectionCard title={t("statement.breakdownTitle")} padding="sm">
              <Reveal
                loading={!ready || statementQ.isLoading}
                skeleton={<Skeleton lines={6} />}
              >
                {breakdown ? (
                  <PayBreakdownList breakdown={breakdown} />
                ) : (
                  <p className="text-sm text-muted">
                    {format.money(statementQ.data?.total ?? 0)}
                  </p>
                )}
              </Reveal>
            </SectionCard>
          </div>

          {sheet && periodClosed && difference !== 0 && (
            <div
              data-f="F-09-070"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2.5"
            >
              <span className="min-w-0 flex-1 text-sm text-fg">
                {t("statement.correctionHint")}
              </span>
              {canManage && (
                <Button size="sm" variant="secondary" loading={correcting} onClick={handleCorrection}>
                  {t("statement.correctionAction", {
                    amount: `${difference > 0 ? "+" : "−"}${format.money(Math.abs(difference))}`,
                  })}
                </Button>
              )}
            </div>
          )}

          {sheet && sheet.status === "draft" && (
            <div
              data-f="F-09-069"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <Badge tone="warning">{t("statement.draftBadge")}</Badge>
                <span className="text-sm text-fg">{t("statement.draftHint")}</span>
              </div>
              {canManage && (
                <Button size="sm" loading={accrueSheetM.isPending} onClick={handleAccrueSheet}>
                  {t("statement.accrueAction")}
                </Button>
              )}
            </div>
          )}

          {sheet && approvalEnabled && (
            <div
              data-f="F-09-100"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2/50 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">
                  {t("statement.approval.statusLabel")}
                </span>
                <Badge
                  tone={
                    approvalStatus === "paid"
                      ? "success"
                      : approvalStatus === "signed"
                        ? "info"
                        : "neutral"
                  }
                >
                  {t(`statement.approval.status.${approvalStatus}`)}
                </Badge>
              </div>
              <div className="flex gap-2">
                {isOwnStatement && approvalStatus === "sentToStaff" && (
                  <Button
                    size="sm"
                    onClick={handleSign}
                    loading={signM.isPending}
                  >
                    {t("statement.approval.sign")}
                  </Button>
                )}
                {canManage &&
                  approvalNext &&
                  approvalStatus !== "sentToStaff" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleAdvance}
                      loading={advanceM.isPending}
                    >
                      {t(`statement.approval.advanceTo.${approvalNext}`)}
                    </Button>
                  )}
              </div>
            </div>
          )}

          {schemeChangedAfterSheet && !periodClosed && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  aria-hidden
                  className="size-4 shrink-0 text-warning"
                />
                <span className="text-sm text-fg">
                  {t("statement.schemeChanged")}
                </span>
              </div>
              {canManage && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={recalculating}
                  leftIcon={<RefreshCw aria-hidden className="size-4" />}
                  onClick={handleRecalculate}
                >
                  {t("statement.recalculate")}
                </Button>
              )}
            </div>
          )}

          <SectionCard title={t("statement.operationsTitle")} padding="sm">
            <Reveal
              loading={!ready || statementQ.isLoading || bookingsQ.isLoading}
              skeleton={<SkeletonList rows={6} avatar={false} />}
            >
            {(statementQ.data?.operations.length ?? 0) === 0 ? (
              <EmptyState compact title={t("statement.empty")} />
            ) : (
              <ul className="flex flex-col gap-3">
                {operationsPage.map((op, i) => {
                  const booking = op.bookingId
                    ? bookingById.get(op.bookingId)
                    : undefined;
                  // F-09-070: если визит правили ПОСЛЕ создания этой ведомости — строка устарела (красная)
                  const stale = Boolean(
                    sheet && booking && booking.updatedAt > sheet.createdAt,
                  );
                  return (
                    <li
                      key={i}
                      className={`rounded-lg border p-3 ${stale ? "border-danger/50 bg-danger/5" : "border-border"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-fg">
                          {op.date} · {op.time}
                        </span>
                        <div className="flex items-center gap-2">
                          {stale && (
                            <Badge tone="danger">{t("statement.stale")}</Badge>
                          )}
                          <span className="font-semibold text-fg">
                            {format.money(op.amount)}
                          </span>
                        </div>
                      </div>
                      <ul className="mt-1.5 flex flex-col gap-0.5">
                        {op.lines.map((line, li) => (
                          <li
                            key={li}
                            className="flex items-center justify-between gap-3 text-sm text-muted"
                          >
                            <span className="min-w-0 truncate">
                              {lineLabel(line)}
                              {line.unpaid ? (
                                <Badge tone="warning" className="ml-2 align-middle">
                                  {t("statement.unpaidLine")}
                                </Badge>
                              ) : null}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {format.money(line.revenue)} →{" "}
                              <span className="text-fg">
                                {format.money(line.amount)}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
            {operationsPager && <div className="mt-4">{operationsPager}</div>}
            </Reveal>
          </SectionCard>

          <SectionCard title={t("statement.extrasTitle")} padding="sm">
            {entriesQ.isLoading ? (
              <SkeletonList rows={2} avatar={false} />
            ) : periodEntries.length === 0 ? (
              <EmptyState
                compact
                icon={<Gift aria-hidden className="size-6" />}
                title={t("statement.noExtras")}
              />
            ) : (
              <ul className="mb-3 flex flex-col gap-2">
                {entriesPage.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {e.label}
                      </p>
                      {e.comment && (
                        <p className="truncate text-xs text-muted">
                          {e.comment}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium tabular-nums ${e.kind === "penalty" ? "text-danger" : "text-success"}`}
                      >
                        {e.kind === "penalty" ? "−" : "+"}
                        {format.money(e.amount)}
                      </span>
                      {canManage && (
                        <IconButton
                          icon={<Trash2 aria-hidden className="size-4" />}
                          label={t("statement.deleteEntry")}
                          onClick={() => handleDeleteEntry(e.id)}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {entriesPager && <div className="mb-3">{entriesPager}</div>}
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Gift aria-hidden className="size-4" />}
                  onClick={() => openEntry("bonus")}
                >
                  {t("statement.addBonus")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Minus aria-hidden className="size-4" />}
                  onClick={() => openEntry("penalty")}
                >
                  {t("statement.addPenalty")}
                </Button>
              </div>
            )}
          </SectionCard>

          {sheet && canManage && !periodClosed && (
            <Button
              variant="danger"
              size="sm"
              className="self-start"
              leftIcon={<Trash2 aria-hidden className="size-4" />}
              onClick={handleDeleteSheet}
            >
              {t("statement.deleteSheet")}
            </Button>
          )}
        </>
      )}

      <Modal
        open={entryOpen !== null}
        onOpenChange={(o) => !o && setEntryOpen(null)}
        title={entryOpen ? t(`statement.entry.${entryOpen}`) : ""}
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {t("statement.entryType")}
            </span>
            <Select
              value={typeId}
              onValueChange={pickType}
              placeholder={t("statement.entryTypePlaceholder")}
              options={typeOptions.map((tt: BonusPenaltyType) => ({
                value: tt.id,
                label: tt.name,
              }))}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("statement.amount")}</span>
            <MoneyInput value={entryAmount} onValueChange={setEntryAmount} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {t("statement.comment")}
            </span>
            <Textarea
              value={entryComment}
              onChange={(e) => setEntryComment(e.target.value)}
              rows={2}
            />
          </label>
          <Button
            loading={entryM.isPending}
            disabled={!entryAmount || entryAmount <= 0}
            onClick={handleEntrySave}
          >
            {t("statement.entryConfirm")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
