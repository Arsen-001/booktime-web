"use client";

/**
 * Удалить навсегда (F-10-041, F-10-155; С4 обзора «Сотрудники», 27.09.2026) — только из «Архива», не рядом с
 * «Уволить». Удаляется лишь карточка без единой записи (заведённая по ошибке): у остальных история записей и
 * выручка в отчётах остаются за мастером — окно так и говорит, а карточка остаётся в архиве уволенных.
 * Удалённая карточка уходит в «Удалённые» архива, оттуда её можно вернуть в любой момент (restoreDeletedStaff).
 * Окно держит последнего сотрудника до конца анимации закрытия (М4).
 */
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { bookingsCountFor, deleteStaffForever, type StaffListRow } from "@/api/staff";
import { getStaffBalance } from "@/api/payroll";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useCurrent } from "@/demo/hooks";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { Modal } from "@/ui/Modal";
import { Skeleton } from "@/ui/Skeleton";
import { useToast } from "@/ui/Toast";

export interface DeleteStaffModalProps {
  row: StaffListRow | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteStaffModal({ row, onOpenChange, onDeleted }: DeleteStaffModalProps) {
  const t = useT("staff");
  const [shown, setShown] = useState<StaffListRow | null>(row);
  if (row && row !== shown) setShown(row);
  return (
    <Modal open={Boolean(row)} onOpenChange={onOpenChange} title={t("deleteStaff.title")}>
      {shown && <DeleteBody key={shown.staff.id} row={shown} onClose={() => onOpenChange(false)} onDeleted={onDeleted} />}
    </Modal>
  );
}

function DeleteBody({ row, onClose, onDeleted }: { row: StaffListRow; onClose: () => void; onDeleted: () => void }) {
  const t = useT("staff");
  const format = useFormat();
  const toast = useToast();
  const { businessId } = useCurrent();
  const staffId = row.staff.id;
  const del = useApiMutation(deleteStaffForever);
  const historyQ = useApiQuery(["staff", "bookingsCount", staffId], () => bookingsCountFor(staffId));
  // F-09-080: невыплаченная зарплата перед удалением — предупреждение с суммой долга
  const balanceQ = useApiQuery(
    ["payroll", "staffBalance", businessId, staffId],
    () => getStaffBalance(businessId ?? "", staffId),
    { enabled: Boolean(businessId) },
  );
  const history = historyQ.data ?? 0;
  const remainingBalance = balanceQ.data?.remaining ?? 0;

  const submit = async () => {
    try {
      await del.mutate(staffId);
      toast.success(t("deleteStaff.success", { name: row.staff.name }));
      onClose();
      onDeleted();
    } catch {
      toast.error(t("deleteStaff.failed"));
    }
  };

  return (
    <div data-f="F-10-041 F-10-155" className="flex flex-col gap-4">
      {historyQ.isLoading ? (
        <div data-skeleton className="flex flex-col gap-2" aria-label={t("deleteStaff.checking")}>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : history > 0 ? (
        <p className="text-sm text-fg">{t("deleteStaff.hasHistory", { name: row.staff.name, count: history })}</p>
      ) : (
        <p className="text-sm text-fg">{t("deleteStaff.archiveDescription", { name: row.staff.name })}</p>
      )}
      {remainingBalance > 0 && (
        <div data-f="F-09-080" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-fg">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>{t("dismissStaff.unpaidBalanceWarning", { amount: format.money(remainingBalance) })}</span>
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose}>
          {t("addStaffForm.cancel")}
        </Button>
        {!historyQ.isLoading && history === 0 && (
          <Button variant="danger" loading={del.isPending} onClick={() => void submit()}>
            {t("deleteStaff.confirmNamed", { name: row.staff.name.split(" ")[0] ?? row.staff.name })}
          </Button>
        )}
      </div>
    </div>
  );
}
