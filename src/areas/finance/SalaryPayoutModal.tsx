"use client";

/**
 * «Выплатить» зарплату (F-07-160, F-09-078) — одно окно для «Взаиморасчётов» и ведомости («Отметить выплаченным»,
 * ответ 28 владельца 17.11.2026): наличными из кассы или переводом с карты, сумма, дата, комментарий. Выплата
 * записывается всегда — расход «Зарплата персонала» в кассе и строка выплаты во взаиморасчётах, долг мастеру уменьшается;
 * по подписанной ведомости (`sheetId`) она сама становится «Выплачено».
 */
import { useState } from "react";
import { listAccountsWithBalance, payoutSalary } from "@/api/finance";
import { ApiError, useApiMutation, useApiQuery } from "@/api/request";
import type { OperationMethod } from "@/domain/finance";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { combine, nowYerevan, today } from "@/lib/date";
import { Button } from "@/ui/Button";
import { DatePicker } from "@/ui/DatePicker";
import { Modal } from "@/ui/Modal";
import { MoneyInput } from "@/ui/MoneyInput";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { Select } from "@/ui/Select";
import { Textarea } from "@/ui/Textarea";
import { useConfirm, useToast } from "@/ui/Toast";

type PayWay = "cash" | "transfer";

export interface SalaryPayoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  locationId: string;
  staffId: string;
  /** Долг мастеру сейчас (остаток к выдаче) — подсказка и предупреждение «больше начисленного» */
  balance: number;
  /** Сумма по умолчанию; нет — остаток к выдаче */
  defaultAmount?: number;
  /** Ведомость, по которой платим (ответ 28) — подписанная станет «Выплачено» */
  sheetId?: string;
  onDone?: () => void;
}

export function SalaryPayoutModal(props: SalaryPayoutModalProps) {
  const t = useT("finance");
  const format = useFormat();
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t("settlements.payout")}
      description={t("settlements.payoutHint", {
        amount: format.money(Math.max(0, props.balance)),
      })}
    >
      {/* Форма заводится заново при каждом открытии — сумма к выдаче и касса с наличными, как «Новый платёж» */}
      {props.open && <PayoutForm {...props} />}
    </Modal>
  );
}

function PayoutForm({
  onOpenChange,
  businessId,
  locationId,
  staffId,
  balance,
  defaultAmount,
  sheetId,
  onDone,
}: SalaryPayoutModalProps) {
  const t = useT("finance");
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const accountsQ = useApiQuery(
    ["finance", "accountsWithBalance", businessId],
    () => listAccountsWithBalance(businessId),
    { enabled: Boolean(businessId) },
  );
  const accounts = accountsQ.data ?? [];

  const [way, setWay] = useState<PayWay>("cash");
  const [amount, setAmount] = useState<number | undefined>(
    () => defaultAmount ?? (balance > 0 ? balance : undefined),
  );
  const [pickedAccountId, setAccountId] = useState<string | undefined>(
    undefined,
  );
  const [date, setDate] = useState(() => today());
  const [comment, setComment] = useState("");

  const wayAccounts = accounts.filter((a) =>
    way === "cash" ? a.kind === "cash" : a.kind !== "cash",
  );
  // Касса — выбранная, если подходит способу, иначе первая подходящая
  const accountId = wayAccounts.some((a) => a.id === pickedAccountId)
    ? pickedAccountId
    : wayAccounts[0]?.id;
  const account = accounts.find((a) => a.id === accountId);
  // Из наличного ящика нельзя выдать больше, чем в нём лежит — видно до нажатия (З5 / Ф2)
  const cashShort = Boolean(
    account && account.kind === "cash" && amount && amount > account.balance,
  );

  const payoutM = useApiMutation(
    (args: {
      amount: number;
      accountId: string;
      method: OperationMethod;
      date: string;
      comment: string;
      allowOverdraft: boolean;
    }) =>
      payoutSalary(
        businessId,
        locationId,
        staffId,
        args.accountId,
        args.amount,
        args.comment,
        {
          method: args.method,
          date: args.date,
          allowOverdraft: args.allowOverdraft,
          sheetId,
        },
      ),
  );

  const handlePay = async () => {
    if (!amount || amount <= 0 || !accountId || cashShort) return;
    if (amount > balance) {
      const ok = await confirm({
        title: t("settlements.overAccruedTitle"),
        description: t("settlements.overAccruedText", {
          amount: format.money(amount),
          accrued: format.money(Math.max(0, balance)),
        }),
        confirmLabel: t("settlements.overAccruedConfirm"),
        tone: "danger",
      });
      if (!ok) return;
    }
    let allowOverdraft = false;
    if (account && account.kind !== "cash" && amount > account.balance) {
      const ok = await confirm({
        title: t("operationForm.overdraftTitle"),
        description: t("operationForm.overdraftText", {
          amount: format.money(account.balance),
        }),
        confirmLabel: t("operationForm.overdraftConfirm"),
        tone: "danger",
      });
      if (!ok) return;
      allowOverdraft = true;
    }
    try {
      await payoutM.mutate({
        amount,
        accountId,
        method: way,
        date: combine(date, nowYerevan().format("HH:mm")),
        comment: comment.trim(),
        allowOverdraft,
      });
      toast.success(t("settlements.payoutDone"));
      onOpenChange(false);
      accountsQ.refetch();
      onDone?.();
    } catch (e) {
      toast.error(
        e instanceof ApiError && e.code === "insufficient_funds"
          ? t("transferForm.insufficientCash", {
              amount: format.money(Number(e.message) || 0),
            })
          : t("settlements.actionFailed"),
      );
    }
  };

  return (
    <div data-f="F-07-160 F-09-078" className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("settlements.amount")}</span>
        <MoneyInput
          value={amount}
          onValueChange={setAmount}
          invalid={cashShort}
        />
        {cashShort && account ? (
          <span className="text-xs text-danger">
            {t("transferForm.insufficientCash", {
              amount: format.money(Math.max(0, account.balance)),
            })}
          </span>
        ) : amount && amount > balance ? (
          <span className="text-xs text-warning-text">
            {t("settlements.overAccruedHint", {
              amount: format.money(amount - Math.max(0, balance)),
            })}
          </span>
        ) : null}
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          {t("settlements.payoutMethod")}
        </span>
        <SegmentedControl
          fullWidth
          size="sm"
          options={[
            { value: "cash", label: t("settlements.payoutWay.cash") },
            { value: "transfer", label: t("settlements.payoutWay.transfer") },
          ]}
          value={way}
          onValueChange={(v) => setWay(v as PayWay)}
        />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          {way === "cash"
            ? t("settlements.payoutWay.cashAccount")
            : t("settlements.payoutWay.transferAccount")}
        </span>
        <Select
          value={accountId}
          onValueChange={setAccountId}
          disabled={accountsQ.isLoading}
          placeholder={
            accountsQ.isLoading ? "…" : t("settlements.payoutWay.noAccount")
          }
          options={wayAccounts.map((a) => ({
            value: a.id,
            label: `${a.name} · ${format.money(a.balance)}`,
          }))}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          {t("settlements.payoutDate")}
        </span>
        <DatePicker
          value={date}
          onValueChange={(v) => v && setDate(v)}
          max={today()}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("settlements.comment")}</span>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder={t("settlements.payoutCommentPlaceholder")}
        />
      </label>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {t("settlements.payoutCancel")}
        </Button>
        <Button
          loading={payoutM.isPending}
          disabled={!amount || amount <= 0 || !accountId || cashShort}
          onClick={handlePay}
        >
          {t("settlements.payoutConfirm")}
        </Button>
      </div>
    </div>
  );
}
