"use client";

/**
 * F-01-151 «Новый платёж» и F-01-084 (штраф — та же форма, статья «Списание штрафа»): плитка левой
 * панели журнала. Настоящие «Счета и кассы»/«Финансовые операции» — раздел «Финансы» (не построен) —
 * пишет в демо-леджер своего среза (`@/api/journal` createLedgerEntry/listLedgerEntries), см.
 * qa/requests/journal.md. История под формой — то немногое, чем журнал может показать «платёж
 * виден» без раздела «Финансы».
 */
import { useState } from "react";
import type { Id, ISODate, TimeHM } from "@/domain/core";
import type {
  JournalLedgerCategory,
  JournalLedgerCounterpartyType,
} from "@/domain/journal";
import { JOURNAL_LEDGER_INCOME_CATEGORIES } from "@/domain/journal";
import {
  cancelLedgerEntry,
  createLedgerEntry,
  listLedgerEntries,
} from "@/api/journal";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useCurrent } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { combine, nowDateTime, timePart, today } from "@/lib/date";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { DatePicker } from "@/ui/DatePicker";
import { EmptyState } from "@/ui/EmptyState";
import { FormField } from "@/ui/FormField";
import { IconButton } from "@/ui/IconButton";
import { Input } from "@/ui/Input";
import { Modal } from "@/ui/Modal";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { Select } from "@/ui/Select";
import { Textarea } from "@/ui/Textarea";
import { TimePicker } from "@/ui/TimePicker";
import { Trash2 } from "lucide-react";
import { useToast } from "@/ui/Toast";

const CATEGORIES: JournalLedgerCategory[] = [
  "materials",
  "goods_purchase",
  "salary",
  "taxes",
  "services",
  "membership_sale",
  "other_income",
  "other_expense",
  "topup",
  "acquiring_fee",
  "certificate_sale",
  "penalty_writeoff",
];

export interface NewPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: Id;
}

export function NewPaymentModal({
  open,
  onOpenChange,
  locationId,
}: NewPaymentModalProps) {
  const t = useT("journal");
  const format = useFormat();
  const toast = useToast();
  const { staffId } = useCurrent();

  const [date, setDate] = useState<ISODate | null>(today());
  const [time, setTime] = useState<TimeHM>(
    timePart(nowDateTime()),
  );
  const [category, setCategory] = useState<JournalLedgerCategory>("materials");
  const [counterpartyType, setCounterpartyType] =
    useState<JournalLedgerCounterpartyType>("contractor");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isIncome = JOURNAL_LEDGER_INCOME_CATEGORIES.includes(category);

  const entriesQuery = useApiQuery(
    ["journal", "ledger", locationId],
    () => listLedgerEntries(locationId),
    { enabled: open },
  );
  const cancelMutation = useApiMutation(cancelLedgerEntry, {
    invalidates: [["journal", "ledger", locationId]],
  });

  const valid = Number(amount) > 0 && counterpartyName.trim().length > 0 && date;

  function reset() {
    setCategory("materials");
    setCounterpartyType("contractor");
    setCounterpartyName("");
    setAmount("");
    setComment("");
    setDate(today());
    setTime(timePart(nowDateTime()));
  }

  async function handleSubmit() {
    if (!valid || !date) return;
    setSubmitting(true);
    try {
      await createLedgerEntry({
        locationId,
        at: combine(date, time),
        category,
        cashRegister: t("window.payment.mainRegister"),
        counterpartyType,
        counterpartyName: counterpartyName.trim(),
        amount: isIncome ? Number(amount) : -Number(amount),
        comment: comment.trim() || undefined,
        createdByStaffId: staffId,
      });
      toast.success(t("sidebar.newPaymentToast"));
      reset();
      entriesQuery.refetch();
    } catch {
      toast.error(t("window.payment.toastFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  const entries = (entriesQuery.data ?? []).filter((e) => !e.canceled);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("sidebar.newPayment")}
      size="md"
    >
      <div data-f="F-01-151 F-01-084 F-04-168 F-04-161" className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("sidebar.newPaymentDate")}>
            <DatePicker value={date} onValueChange={setDate} />
          </FormField>
          <FormField label={t("sidebar.newPaymentTime")}>
            <TimePicker value={time} onValueChange={setTime} />
          </FormField>
        </div>

        <FormField label={t("sidebar.newPaymentCategory")}>
          <Select
            options={CATEGORIES.map((c) => ({
              value: c,
              label: t(`sidebar.ledgerCategory.${c}`),
            }))}
            value={category}
            onValueChange={(v) => setCategory(v as JournalLedgerCategory)}
          />
        </FormField>

        <FormField
          label={
            isIncome
              ? t("sidebar.newPaymentPayer")
              : t("sidebar.newPaymentRecipient")
          }
        >
          <div data-f="F-01-084" className="flex flex-col gap-2">
            <SegmentedControl
              value={counterpartyType}
              onValueChange={(v) =>
                setCounterpartyType(v as JournalLedgerCounterpartyType)
              }
              options={[
                { value: "contractor", label: t("sidebar.counterpartyContractor") },
                { value: "client", label: t("sidebar.counterpartyClient") },
                { value: "staff", label: t("sidebar.counterpartyStaff") },
              ]}
              fullWidth
            />
            <Input
              value={counterpartyName}
              onChange={(e) => setCounterpartyName(e.target.value)}
              placeholder={
                counterpartyType === "client"
                  ? t("sidebar.newPaymentClientPlaceholder")
                  : t("sidebar.newPaymentContractorPlaceholder")
              }
            />
          </div>
        </FormField>

        <FormField label={t("sidebar.newPaymentAmount")}>
          <Input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="0"
          />
        </FormField>

        <FormField label={t("sidebar.newPaymentComment")}>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />
        </FormField>

        <Button
          type="button"
          disabled={!valid}
          loading={submitting}
          onClick={handleSubmit}
        >
          {t("sidebar.newPaymentSubmit")}
        </Button>

        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted">
            {t("sidebar.newPaymentHistory")}
          </p>
          {entriesQuery.isLoading && (
            <div className="h-16 animate-pulse rounded-lg bg-surface-2" />
          )}
          {!entriesQuery.isLoading && entries.length === 0 && (
            <EmptyState compact title={t("sidebar.newPaymentEmpty")} />
          )}
          {entries.slice(0, 8).map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-fg">
                  {t(`sidebar.ledgerCategory.${e.category}`)}
                </p>
                <p className="truncate text-xs text-muted">
                  {e.counterpartyName} · {format.dateTime(e.at)}
                </p>
              </div>
              <Badge tone={e.amount >= 0 ? "success" : "neutral"} size="sm">
                {format.money(e.amount)}
              </Badge>
              <IconButton
                icon={<Trash2 aria-hidden />}
                label={t("sidebar.newPaymentCancel")}
                size="sm"
                onClick={() => cancelMutation.mutate(e.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
