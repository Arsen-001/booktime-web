"use client";

/**
 * F-01-146: снимок условий ручной предоплаты (F-00-097) в окне визита — сумма, дедлайн бесплатной
 * отмены (зелёный календарь до срока, красный после, точная дата по наведению) и статус: оплачено /
 * ждёт / штраф удержан / штраф прощён. Снимок именно снимок — не пересчитывается при правке визита
 * (услуги/мастер), как и требует ТЗ; решение по штрафу пишет BookingWindow (handleStatusChange для
 * «Не пришёл», handleSave для позднего переноса) через `decidePrepayment` — см. qa/questions/journal.md.
 * У нас нет автоматических штрафов через онлайн-эквайринг (F-00-028 отложено) — снимок всегда про
 * ручную предоплату F-00-097.
 */
import { Calendar, CircleDollarSign } from "lucide-react";
import type { Booking } from "@/domain/core";
import type { PrepaymentDecision } from "@/domain/journal";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { cn } from "@/lib/cn";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Tooltip } from "@/ui/Tooltip";

export interface PaymentPolicyBlockProps {
  prepayment: NonNullable<Booking["prepayment"]>;
  freeCancelUntil: string;
  now: string;
  decision?: PrepaymentDecision;
  /** Клиент отменил позже срока бесплатной отмены (Booking.cancelledLate) */
  cancelledLate?: boolean;
  /** «Вернул» — мастер вернул предоплату (refundDue > 0) */
  onRefunded?: () => void;
  refunding?: boolean;
}

export function PaymentPolicyBlock({
  prepayment,
  freeCancelUntil,
  now,
  decision,
  cancelledLate,
  onRefunded,
  refunding,
}: PaymentPolicyBlockProps) {
  const t = useT("journal");
  const format = useFormat();
  const isPast = now >= freeCancelUntil;

  return (
    <div
      data-f="F-01-146"
      className="flex flex-col gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm"
    >
      <div className="flex items-center gap-2">
        <CircleDollarSign aria-hidden className="size-4 shrink-0 text-muted" />
        <span className="font-medium text-fg">
          {prepayment.full ? t("window.policy.titleFull") : t("window.policy.title")}
        </span>
        <span className="ml-auto shrink-0 font-medium text-fg">
          {format.money(prepayment.amount)}
        </span>
      </div>
      {prepayment.reason === "no_shows" && (
        <p className="text-xs text-muted" data-f="F-00-071">
          {t("window.policy.noShowsReason", { count: prepayment.noShows ?? 2, months: prepayment.months ?? 12 })}
        </p>
      )}
      <div className="flex items-center gap-2 text-xs text-muted">
        <Tooltip content={format.dateTime(freeCancelUntil)}>
          <span className="flex items-center gap-1">
            <Calendar
              aria-hidden
              className={cn(
                "size-3.5 shrink-0",
                isPast ? "text-danger" : "text-success",
              )}
            />
            {isPast
              ? t("window.policy.deadlinePast")
              : t("window.policy.deadlineUpcoming", {
                  date: format.dateTime(freeCancelUntil),
                })}
          </span>
        </Tooltip>
      </div>
      <div className="flex items-center gap-2">
        {prepayment.paid && (prepayment.refundDue ?? 0) > 0 ? (
          <>
            <Badge tone="warning" size="sm">
              {t("window.policy.refundDue", { amount: format.money(prepayment.refundDue ?? 0) })}
            </Badge>
            {onRefunded && (
              <Button size="sm" variant="secondary" className="ml-auto" loading={refunding} onClick={onRefunded}>
                {t("window.policy.refundDone")}
              </Button>
            )}
          </>
        ) : prepayment.paid && prepayment.refundedAt ? (
          <Badge tone="neutral" size="sm">
            {t("window.policy.refunded", { date: format.dateTime(prepayment.refundedAt) })}
          </Badge>
        ) : prepayment.paid && cancelledLate ? (
          <Badge tone="success" size="sm">
            {t("window.policy.keptLateCancel")}
          </Badge>
        ) : !prepayment.paid ? (
          <Badge tone="neutral" size="sm">
            {t("window.policy.statusPending")}
          </Badge>
        ) : decision ? (
          <Badge tone={decision.kept ? "danger" : "success"} size="sm">
            {decision.kept
              ? t("window.policy.statusCharged")
              : t("window.policy.statusWaived")}
          </Badge>
        ) : (
          <Badge tone="success" size="sm">
            {t("window.policy.statusPaid")}
          </Badge>
        )}
      </div>
    </div>
  );
}
