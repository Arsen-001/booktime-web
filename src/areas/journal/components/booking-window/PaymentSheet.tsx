"use client";

/**
 * Окно «Оплата визита» (F-01-138…146, частично F-01-207/209/212). Открывается кнопкой «Оплатить» в
 * CenterZone. Две вкладки: «Быстрая оплата» (F-01-138, один клик — наличные/карта закрывают всю
 * сумму) и «Раздельная оплата» (F-01-139, несколько строк на разные способы, включая лояльность —
 * F-01-140).
 *
 * Л1 (27.09.2026): плитки лояльности (абонемент, сертификат, бонусы, личный счёт) проводятся тем же движком,
 * что и вкладка «Лояльность» окна записи (@/api/loyalty → payVisitWithLoyalty): лимиты карты, применимость
 * абонемента и сертификата к услугам визита, одна строка платежа визита на одну транзакцию лояльности
 * (refId). Отмена строки возвращает списанное, кэшбэк за визит пересчитывается после каждой оплаты и отмены.
 */
import { useState } from "react";
import { Banknote, CreditCard, Gift, Landmark, Ticket, Trash2, Wallet } from "lucide-react";
import type { Id } from "@/domain/core";
import type { JournalPaymentLine } from "@/domain/journal";
import {
  cancelVisitPaymentLine,
  getBonusChargeInfo,
  getLoyaltyBookingSummary,
  isLoyaltyPaymentRef,
  listClientAccounts,
  payVisitWithLoyalty,
  previewCashback,
  syncBookingCashback,
  visitPaymentsForCashback,
  type LoyaltyVisit,
  type VisitServiceLine,
} from "@/api/loyalty";
import type { LoyaltyPaymentLineInput } from "@/domain/loyalty";
import { PREPAYMENT_LINE_LABEL, payBookingLines, refundPaymentLine } from "@/api/journal";
import { useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { IconButton } from "@/ui/IconButton";
import { Input } from "@/ui/Input";
import { Modal } from "@/ui/Modal";
import { Skeleton } from "@/ui/Skeleton";
import { Tabs } from "@/ui/Tabs";
import { useToast } from "@/ui/Toast";
import { runBusy } from "@/areas/journal/lib/tasks";

export interface PaymentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  locationId: Id;
  bookingId: Id;
  total: number;
  paidAmount: number;
  payments: JournalPaymentLine[];
  clientPhone?: string;
  /** F-01-210/145: без clientId (клиент не выбран) лояльности и «Личного счёта» нет */
  clientId?: Id;
  /** Услуги визита — применимость абонемента/сертификата/бонусов и превью кэшбэка (Л1, Л7) */
  visitLines?: VisitServiceLine[];
  /** F-01-138: без права «Проводить оплату» окно вообще не открыть — гейт стоит у вызывающего (CenterZone) */
  onPaid: (extras: { paidAmount: number; payments: JournalPaymentLine[] }) => void;
}

export function PaymentSheet({
  open,
  onOpenChange,
  businessId,
  locationId,
  bookingId,
  total,
  paidAmount,
  payments,
  clientId,
  visitLines = [],
  onPaid,
}: PaymentSheetProps) {
  const t = useT("journal");
  const format = useFormat();
  const toast = useToast();

  const remaining = Math.max(0, total - paidAmount);
  const paidFully = total > 0 && paidAmount >= total;
  const visit: LoyaltyVisit = { lines: visitLines, locationId, bookingId };
  // ключ по составу услуг, а не по остатку: оплата строки не перечитывает плитки (Л15)
  const visitKey = visitLines.map((l) => `${l.serviceId}:${l.price}:${l.listPrice ?? l.price}`).join("|");

  const [tab, setTab] = useState<"quick" | "split">("quick");
  const [submitting, setSubmitting] = useState(false);
  const [cancelingId, setCancelingId] = useState<Id | null>(null);
  const [splitCash, setSplitCash] = useState("");
  const [splitCard, setSplitCard] = useState("");
  const [refundingLineId, setRefundingLineId] = useState<Id | null>(null);
  const [refundAmount, setRefundAmount] = useState("");

  const summaryQuery = useApiQuery(
    ["journal", "pay-loyalty", businessId, clientId, visitKey],
    () => getLoyaltyBookingSummary(businessId, clientId!, visit),
    { enabled: open && Boolean(clientId), keepPrevious: true },
  );
  // F-01-210/145: счета клиента — только если клиент выбран
  const accountsQuery = useApiQuery(
    ["journal", "pay-accounts", businessId, clientId],
    () => listClientAccounts(businessId, clientId!),
    { enabled: open && Boolean(clientId) },
  );
  const moneyPaid = payments.filter((p) => p.method === "cash" || p.method === "card" || p.method === "personal_account").reduce((sum, p) => sum + p.amount, 0);
  // Л7: превью кэшбэка — если остаток заплатить деньгами; keepPrevious — цифра меняется без мигания
  const cashbackQuery = useApiQuery(
    ["journal", "pay-cashback", businessId, clientId, bookingId, visitKey, moneyPaid + remaining],
    () => previewCashback(businessId, clientId!, visit, moneyPaid + remaining),
    { enabled: open && Boolean(clientId), keepPrevious: true },
  );

  const loyaltyLoading = summaryQuery.isLoading || accountsQuery.isLoading;
  const memberships = (summaryQuery.data?.memberships ?? []).filter((m) => m.applicable && m.coverAmount > 0);
  const certificates = (summaryQuery.data?.certificates ?? []).filter((c) => c.coverAmount > 0);
  const cards = (summaryQuery.data?.cards ?? []).filter((c) => c.balance > 0);
  // F-01-210/145: счета с положительным остатком или с разрешённой оплатой в минус
  const accounts = (accountsQuery.data ?? []).filter((a) => a.maxCharge > 0);
  // F-01-140: если хоть одну услугу можно оплатить лояльностью, лояльность стоит первой
  const hasLoyalty = memberships.length + certificates.length + cards.length + accounts.length > 0;
  const cashbackAhead = Math.max(0, (cashbackQuery.data?.total ?? 0) - (cashbackQuery.data?.accrued ?? 0));

  async function syncCashback(nextPayments: JournalPaymentLine[]) {
    // Платёж кассы есть и строкой журнала (id = ключ платежа) — visitPaymentsForCashback считает его один раз
    if (clientId) await syncBookingCashback(businessId, locationId, clientId, bookingId, await visitPaymentsForCashback(businessId, bookingId, nextPayments), visit);
  }

  async function finishWithLines(lines: Parameters<typeof payBookingLines>[1]) {
    // try…finally — в runBusy (src/areas/journal/lib/tasks.ts): в теле компонента React Compiler его не компилирует
    await runBusy(
      setSubmitting,
      async () => {
        const extras = await payBookingLines(bookingId, lines);
        await syncCashback(extras.payments ?? []);
        onPaid({ paidAmount: extras.paidAmount, payments: extras.payments ?? [] });
        toast.success(t("window.payment.toastPaid"));
      },
      () => toast.error(t("window.payment.toastFailed")),
    );
  }

  /** Л1: абонемент, сертификат, бонусы, личный счёт — через движок лояльности, одной строкой платежа визита */
  async function payLoyalty(line: LoyaltyPaymentLineInput, label: string) {
    if (!clientId || remaining <= 0) return;
    await runBusy(
      setSubmitting,
      async () => {
        const extras = await payVisitWithLoyalty({ businessId, locationId, bookingId, clientId, lines: [line], visit, labelOf: () => label });
        onPaid({ paidAmount: extras.paidAmount, payments: extras.payments ?? [] });
        toast.success(t("window.payment.toastPaid"));
      },
      () => toast.error(t("window.payment.toastFailed")),
    );
  }

  async function payCardBonus(cardId: Id, label: string) {
    const info = await getBonusChargeInfo(businessId, cardId, remaining, visit);
    if (info.max <= 0) {
      toast.error(t("window.payment.bonusUnavailable"));
      return;
    }
    await payLoyalty({ kind: "bonus", amount: info.max, cardId }, label);
  }

  async function payQuick(method: "cash" | "card") {
    if (remaining <= 0) return;
    await finishWithLines([
      {
        method,
        amount: remaining,
        label:
          method === "cash"
            ? t("window.payment.methodCash")
            : t("window.payment.methodCard"),
        cashRegister: t("window.payment.mainRegister"),
      },
    ]);
  }

  const splitTotal = (Number(splitCash) || 0) + (Number(splitCard) || 0);
  const splitValid = splitTotal > 0 && splitTotal <= remaining + 0.001;

  async function submitSplit() {
    const lines: Parameters<typeof payBookingLines>[1] = [];
    if (Number(splitCash) > 0) {
      lines.push({
        method: "cash",
        amount: Number(splitCash),
        label: t("window.payment.methodCash"),
        cashRegister: t("window.payment.mainRegister"),
      });
    }
    if (Number(splitCard) > 0) {
      lines.push({
        method: "card",
        amount: Number(splitCard),
        label: t("window.payment.methodCard"),
        cashRegister: t("window.payment.mainRegister"),
      });
    }
    if (!lines.length) return;
    await finishWithLines(lines);
    setSplitCash("");
    setSplitCard("");
  }

  /** F-01-212: полный возврат — убирает строку целиком; строка лояльности возвращает списанное (Л1) */
  async function cancelLine(line: JournalPaymentLine) {
    await runBusy(
      (busy) => setCancelingId(busy ? line.id : null),
      async () => {
        const extras = await cancelVisitPaymentLine({ businessId, locationId, bookingId, clientId, visit }, line);
        onPaid({ paidAmount: extras.paidAmount, payments: extras.payments ?? [] });
        toast.success(t("window.payment.toastCanceled"));
      },
      () => toast.error(t("window.payment.toastFailed")),
    );
  }

  /** F-01-212: частичный возврат — только деньгами оплаченной строки; полная сумма ушла бы в cancelLine */
  async function confirmPartialRefund(lineId: Id, lineAmount: number) {
    const amount = Number(refundAmount);
    if (!amount || amount <= 0 || amount > lineAmount) return;
    await runBusy(
      (busy) => setCancelingId(busy ? lineId : null),
      async () => {
        const extras = await refundPaymentLine(bookingId, lineId, amount);
        await syncCashback(extras.payments ?? []);
        onPaid({ paidAmount: extras.paidAmount, payments: extras.payments ?? [] });
        toast.success(t("window.payment.refundDone"));
        setRefundingLineId(null);
        setRefundAmount("");
      },
      () => toast.error(t("window.payment.toastFailed")),
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("window.payment.title")}
      size="md"
    >
      <div data-f="F-01-138 F-01-139 F-01-142" className="flex flex-col gap-4">
        {/* Л1: «К оплате» — остаток визита, та же цифра, что на вкладке «Лояльность» */}
        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
          <span className="text-sm text-muted">{t("window.toPay")}</span>
          <span className="flex items-baseline gap-2">
            {paidAmount > 0 && (
              <span className="text-xs text-muted">{t("window.payment.ofTotal", { amount: format.money(total) })}</span>
            )}
            <span className="text-lg font-semibold text-fg">{format.money(remaining)}</span>
          </span>
        </div>

        {payments.length > 0 && (
          <div data-f="F-01-143 F-01-212" className="flex flex-col gap-1.5">
            {payments.map((line) => {
              const loyaltyLine = isLoyaltyPaymentRef(line.refId);
              // Предоплата переводом (F-00-097) возвращается отменой записи (F-00-100), не отсюда
              const prepaymentLine = line.label === PREPAYMENT_LINE_LABEL;
              return (
                <div
                  key={line.id}
                  className="flex flex-col gap-1.5 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-fg">
                      {prepaymentLine ? t("window.policy.paymentLine") : line.label}
                    </span>
                    <span className="shrink-0 font-medium text-fg">
                      {line.method === "promotion" ? "−" : ""}
                      {format.money(line.amount)}
                    </span>
                    {!loyaltyLine && !prepaymentLine && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={cancelingId === line.id}
                        onClick={() =>
                          setRefundingLineId((id) => (id === line.id ? null : line.id))
                        }
                      >
                        {t("window.payment.refundPartial")}
                      </Button>
                    )}
                    {!prepaymentLine && (
                      <IconButton
                        icon={<Trash2 aria-hidden />}
                        label={t("window.payment.cancelLine")}
                        size="sm"
                        disabled={cancelingId === line.id}
                        onClick={() => cancelLine(line)}
                      />
                    )}
                  </div>
                  {refundingLineId === line.id && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value.replace(/[^\d.]/g, ""))}
                        placeholder={String(line.amount)}
                        className="!min-h-9"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={cancelingId === line.id}
                        onClick={() => confirmPartialRefund(line.id, line.amount)}
                      >
                        {t("window.payment.refundConfirm")}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {clientId && (cashbackAhead > 0 || (cashbackQuery.data?.accrued ?? 0) > 0) && (
          <p data-f="F-06-070" className="flex items-center gap-2 text-sm text-muted">
            <Gift aria-hidden className="size-4 shrink-0 text-primary-text" />
            {remaining > 0 && cashbackAhead > 0
              ? t("window.payment.cashbackPreview", { amount: format.money(cashbackAhead) })
              : t("window.payment.cashbackAccrued", { amount: format.money(cashbackQuery.data?.accrued ?? 0) })}
          </p>
        )}

        {paidFully ? (
          <div
            data-f="F-01-142"
            className="flex flex-col items-center gap-1 rounded-xl bg-success/10 px-4 py-5 text-center"
          >
            <Badge tone="success">{t("window.paidFull")}</Badge>
            <p className="text-xs text-muted">{t("window.payment.receiptHint")}</p>
          </div>
        ) : (
          <>
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as "quick" | "split")}
              variant="pill"
              items={[
                { value: "quick", label: t("window.payment.tabQuick") },
                { value: "split", label: t("window.payment.tabSplit") },
              ]}
            />

            {tab === "quick" && (
              <div data-f="F-01-138 F-01-140 F-01-145" className="flex flex-col gap-2">
                {hasLoyalty && (
                  <p className="text-xs text-muted">
                    {t("window.payment.loyaltyFirstHint")}
                  </p>
                )}
                {/* скелет той же формы, что плитка, — одна строка на время первой загрузки */}
                {clientId && loyaltyLoading && <Skeleton variant="rect" className="h-14 rounded-lg" />}
                {memberships.map((m) => (
                  <PayTile
                    key={m.id}
                    icon={Ticket}
                    label={m.typeName}
                    hint={t("window.payment.membershipCoverHint", { amount: format.money(Math.min(m.coverAmount, remaining)) })}
                    disabled={submitting}
                    onClick={() => payLoyalty({ kind: "membership", amount: remaining, membershipId: m.id }, m.typeName)}
                  />
                ))}
                {certificates.map((c) => {
                  const amount = Math.min(c.balance, c.coverAmount, remaining);
                  const burns = c.single && c.balance > amount ? c.balance - amount : 0;
                  const label = t("window.payment.certificateLabel", { code: c.code });
                  return (
                    <PayTile
                      key={c.id}
                      icon={Gift}
                      label={label}
                      hint={
                        burns > 0
                          ? t("window.payment.certificateBurnHint", { amount: format.money(amount), rest: format.money(burns) })
                          : t("window.payment.certificateHint", { amount: format.money(amount), balance: format.money(c.balance) })
                      }
                      disabled={submitting}
                      onClick={() => payLoyalty({ kind: "certificate", amount, certificateId: c.id }, label)}
                    />
                  );
                })}
                {cards.map((c) => (
                  <PayTile
                    key={c.id}
                    icon={CreditCard}
                    label={t("window.payment.bonusLabel", { name: c.cardTypeName })}
                    hint={t("window.payment.balanceHint", { amount: format.money(c.balance) })}
                    disabled={submitting}
                    onClick={() => payCardBonus(c.id, t("window.payment.bonusLabel", { name: c.cardTypeName }))}
                  />
                ))}
                {accounts.map((a) => (
                  <PayTile
                    key={a.id}
                    icon={Banknote}
                    label={t("window.payment.accountLabel", { name: a.typeName })}
                    hint={t("window.payment.balanceHint", { amount: format.money(a.balance) })}
                    disabled={submitting}
                    onClick={() =>
                      payLoyalty(
                        { kind: "account", amount: Math.min(a.maxCharge, remaining), accountId: a.id },
                        t("window.payment.accountLabel", { name: a.typeName }),
                      )
                    }
                  />
                ))}
                <PayTile
                  icon={Wallet}
                  label={t("window.payment.methodCash")}
                  hint={t("window.payment.mainRegister")}
                  disabled={submitting || remaining <= 0}
                  onClick={() => payQuick("cash")}
                />
                <PayTile
                  icon={Landmark}
                  label={t("window.payment.methodCard")}
                  hint={t("window.payment.mainRegister")}
                  disabled={submitting || remaining <= 0}
                  onClick={() => payQuick("card")}
                />
                <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted">
                  {t("window.payment.linkComingSoon")}
                </div>
              </div>
            )}

            {tab === "split" && (
              <div data-f="F-01-139" className="flex flex-col gap-3">
                {/* Остаток пересчитывается по мере ввода сумм; перебор — красным (кнопка при этом выключена) */}
                <p className={splitTotal > remaining + 0.001 ? "text-xs text-danger" : "text-xs text-muted"}>
                  {t("window.payment.splitHint", { amount: format.money(Math.max(0, remaining - splitTotal)) })}
                </p>
                <FormField label={t("window.payment.methodCash")}>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={splitCash}
                    onChange={(e) => setSplitCash(e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="0"
                  />
                </FormField>
                <FormField label={t("window.payment.methodCard")}>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={splitCard}
                    onChange={(e) => setSplitCard(e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="0"
                  />
                </FormField>
                <Button
                  type="button"
                  disabled={!splitValid}
                  loading={submitting}
                  onClick={submitSplit}
                >
                  {t("window.payment.paySplit", { amount: format.money(splitTotal) })}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function PayTile({
  icon: Icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon: typeof Wallet;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      className="flex min-h-14 items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors enabled:hover:bg-surface-2 disabled:opacity-50"
    >
      <Icon aria-hidden className="size-4 shrink-0 text-muted" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">{label}</span>
        {hint && <span className="block truncate text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}
