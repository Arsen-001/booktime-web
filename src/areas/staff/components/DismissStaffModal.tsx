"use client";

/**
 * Уволить сотрудника (F-10-040, F-10-042, F-10-043; С3 обзора «Сотрудники», 27.09.2026).
 *  - Дата работает: сегодня — сразу; в будущем — до этого дня человек работает и остаётся в графике.
 *  - Записи с этой даты — прямо здесь, у каждой выбор: передать мастеру, отменить с уведомлением клиента или
 *    оставить; сверху — один выбор на все сразу.
 *  - Подтверждение обычной кнопкой «Уволить Гаяне» (увольнение обратимо) — без набора слова DISMISS.
 *  - После — тост «Отменить» на 5 секунд; вернуть из «Архива» можно в любой момент.
 * Окно держит последнего сотрудника, пока играет анимация закрытия (М4: раньше исчезало за один кадр).
 */
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  dismissStaff,
  listFutureBookingsFor,
  listStaffRows,
  resolveFutureBookings,
  restoreStaff,
  undoFutureBookings,
  type FutureBookingRow,
  type StaffListRow,
} from "@/api/staff";
import { getStaffBalance } from "@/api/payroll";
import { useApiQuery } from "@/api/request";
import { useCurrent } from "@/demo/hooks";
import { emptyStaffFilters, isAssistantStaff, type FutureBookingDecision } from "@/domain/staff";
import { useFormat } from "@/i18n/useFormat";
import { today } from "@/lib/date";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { DatePicker } from "@/ui/DatePicker";
import { FormField } from "@/ui/FormField";
import { Modal } from "@/ui/Modal";
import { Select, type SelectOption } from "@/ui/Select";
import { Skeleton } from "@/ui/Skeleton";
import { Textarea } from "@/ui/Textarea";
import { useToast } from "@/ui/Toast";

export interface DismissStaffModalProps {
  row: StaffListRow | null;
  onOpenChange: (open: boolean) => void;
  onDismissed: () => void;
}

/** Значение выбора у записи: "keep" | "cancel" | "to:<staffId>" */
type Choice = string;

function toDecision(bookingId: string, choice: Choice): FutureBookingDecision {
  if (choice.startsWith("to:")) return { bookingId, action: "reassign", toStaffId: choice.slice(3) };
  if (choice === "cancel") return { bookingId, action: "cancel" };
  return { bookingId, action: "keep" };
}

export function DismissStaffModal({ row, onOpenChange, onDismissed }: DismissStaffModalProps) {
  // Последний показанный сотрудник живёт до конца анимации закрытия (М4)
  const [shown, setShown] = useState<StaffListRow | null>(row);
  if (row && row !== shown) setShown(row);
  return (
    <Modal
      open={Boolean(row)}
      onOpenChange={(o) => onOpenChange(o)}
      title={shown ? <DismissTitle row={shown} /> : ""}
      description={<DismissDescription />}
      size="lg"
    >
      {shown && <DismissBody key={shown.staff.id} row={shown} onClose={() => onOpenChange(false)} onDismissed={onDismissed} />}
    </Modal>
  );
}

function DismissDescription() {
  const t = useT("staff");
  return <>{t("dismissStaff.description")}</>;
}

function DismissTitle({ row }: { row: StaffListRow }) {
  const t = useT("staff");
  return <>{t("dismissStaff.title", { name: row.staff.name })}</>;
}

function DismissBody({ row, onClose, onDismissed }: { row: StaffListRow; onClose: () => void; onDismissed: () => void }) {
  const t = useT("staff");
  const format = useFormat();
  const toast = useToast();
  const { businessId } = useCurrent();
  const staffId = row.staff.id;
  const firstName = row.staff.name.split(" ")[0] ?? row.staff.name;
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState("");
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [bulk, setBulk] = useState<Choice>("keep");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const futureQ = useApiQuery(["staff", "futureBookings", staffId, date], () => listFutureBookingsFor(staffId, date));
  const mastersQ = useApiQuery(
    ["staff", "list", businessId, "reassign"],
    () => listStaffRows({ businessId: businessId ?? "", filters: emptyStaffFilters() }),
    { enabled: Boolean(businessId) },
  );
  // F-09-080: невыплаченная зарплата перед увольнением — предупреждение с суммой долга
  const balanceQ = useApiQuery(
    ["payroll", "staffBalance", businessId, staffId],
    () => getStaffBalance(businessId ?? "", staffId),
    { enabled: Boolean(businessId) },
  );

  const bookings = futureQ.data ?? [];
  const masters = (mastersQ.data ?? []).filter(
    (r) =>
      r.staff.id !== staffId &&
      r.staff.status !== "fired" &&
      !isAssistantStaff(r.staff) &&
      (r.staff.role === "master" || r.servicesCount > 0),
  );
  const choiceOptions: SelectOption[] = [
    ...masters.map((m) => ({ value: `to:${m.staff.id}`, label: `${t("dismissStaff.action.reassign")}: ${m.staff.name}` })),
    { value: "cancel", label: t("dismissStaff.action.cancel") },
    { value: "keep", label: t("dismissStaff.action.keep") },
  ];
  const choiceOf = (b: FutureBookingRow) => choices[b.id] ?? bulk;
  const scheduled = date > today();
  const remainingBalance = balanceQ.data?.remaining ?? 0;
  const shortDate = format.date(date, "short");

  const submit = async () => {
    setError(null);
    setPending(true);
    const decisions = bookings.map((b) => toDecision(b.id, choiceOf(b)));
    const before = bookings;
    try {
      const resolved = await resolveFutureBookings(staffId, decisions);
      await dismissStaff(staffId, { date, reason });
      onClose();
      onDismissed();
      const undo = async () => {
        try {
          await restoreStaff(staffId);
          await undoFutureBookings(staffId, decisions, before);
          toast.success(t("toast.dismissalCancelled", { name: row.staff.name }));
        } catch {
          toast.error(t("toast.actionFailed"));
        }
      };
      toast.success(
        scheduled ? t("toast.dismissScheduled", { name: row.staff.name, date: shortDate }) : t("toast.fired", { name: row.staff.name }),
        {
          description:
            resolved.reassigned + resolved.cancelled > 0 ? t("toast.bookingsResolved", resolved) : undefined,
          action: { label: t("toast.undo"), onClick: () => void undo() },
          durationMs: 5000,
        },
      );
    } catch {
      setError(t("toast.actionFailed"));
      setPending(false);
    }
  };

  return (
    <form
      data-f="F-10-040 F-10-042 F-10-043 F-10-155"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      {/* F-00-044: увольнение не трогает фото/дипломы мастера и клиентов/записи салона — их никто здесь не удаляет */}
      <span data-f="F-00-044" hidden />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={t("dismissStaff.date")} required hint={scheduled ? t("dismissStaff.dateHint", { name: firstName }) : undefined}>
          <DatePicker value={date} min={today()} onValueChange={(d) => setDate(d ?? today())} />
        </FormField>
        <FormField label={t("dismissStaff.reason")} optional>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("dismissStaff.reasonPlaceholder")} rows={1} />
        </FormField>
      </div>

      <section className="flex flex-col gap-2 rounded-xl border border-border p-3" aria-live="polite">
        {futureQ.isLoading ? (
          <div data-skeleton className="flex flex-col gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : bookings.length === 0 ? (
          <p className="text-sm text-muted">{t("dismissStaff.bookingsNone")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-fg">{t("dismissStaff.bookingsTitle", { count: bookings.length, date: shortDate })}</p>
              <Select
                aria-label={t("dismissStaff.bulkLabel")}
                className="w-full sm:w-72"
                value={bulk}
                onValueChange={(v) => {
                  setBulk(v);
                  setChoices({});
                }}
                options={choiceOptions}
              />
            </div>
            {masters.length === 0 && <p className="text-xs text-muted">{t("dismissStaff.noOtherMasters")}</p>}
            <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto scrollbar-thin">
              {bookings.map((b) => (
                <li key={b.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium text-fg tabular-nums">{format.dateTime(b.start)}</span>
                    <span className="text-muted"> · {[b.clientName, b.serviceName].filter(Boolean).join(" · ") || "—"}</span>
                  </span>
                  <Select
                    aria-label={`${format.dateTime(b.start)} ${b.clientName}`}
                    className="w-full sm:w-64"
                    value={choiceOf(b)}
                    onValueChange={(v) => setChoices((c) => ({ ...c, [b.id]: v }))}
                    options={choiceOptions}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {remainingBalance > 0 && (
        <div data-f="F-09-080" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-fg">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>{t("dismissStaff.unpaidBalanceWarning", { amount: format.money(remainingBalance) })}</span>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button variant="outline" type="button" onClick={onClose}>
          {t("addStaffForm.cancel")}
        </Button>
        <Button variant="danger" type="submit" loading={pending} disabled={futureQ.isLoading}>
          {scheduled ? t("dismissStaff.confirmScheduled", { name: firstName, date: shortDate }) : t("dismissStaff.confirmNow", { name: firstName })}
        </Button>
      </div>
    </form>
  );
}
