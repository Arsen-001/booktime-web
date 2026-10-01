"use client";

/**
 * F-01-020: два пункта меню по имени сотрудника, которых не хватало — «Добавить рабочие дни» и
 * «Удалить рабочие дни» на диапазон дат (одна попытка сохранить/удалить только текущий день уже
 * была — StaffScheduleModal/handleCancelDay в DayGrid). Пишет через setCells()/deleteCells() раздела
 * schedule — свои записи в чужой срез не заводим (см. AGENTS.md §1).
 */
import { useState } from "react";
import type { DayHours, Id, ISODate, Staff } from "@/domain/core";
import { deleteCells, findAffectedBookings, setCells } from "@/api/schedule";
import { useCurrent } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { eachDay } from "@/lib/date";
import { Button } from "@/ui/Button";
import { DatePicker } from "@/ui/DatePicker";
import { FormField } from "@/ui/FormField";
import { Modal } from "@/ui/Modal";
import { TimePicker } from "@/ui/TimePicker";
import { useConfirm, useToast } from "@/ui/Toast";

export interface WorkingDaysRangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "remove";
  staffId: Id;
  staffList: Staff[];
  defaultDate: ISODate;
  onSaved: () => void;
}

export function WorkingDaysRangeModal({
  open,
  onOpenChange,
  mode,
  staffId,
  staffList,
  defaultDate,
  onSaved,
}: WorkingDaysRangeModalProps) {
  const t = useT("journal");
  const tc = useT("common");
  const toast = useToast();
  const confirm = useConfirm();
  const { staffId: ownStaffId } = useCurrent();
  const [from, setFrom] = useState<string | null>(defaultDate);
  const [to, setTo] = useState<string | null>(defaultDate);
  const [hoursFrom, setHoursFrom] = useState("10:00");
  const [hoursTo, setHoursTo] = useState("22:00");
  const [saving, setSaving] = useState(false);

  const staffName =
    staffList.find((s) => s.id === staffId)?.name ??
    t("window.deleteAuthorFallback");
  const actorName =
    staffList.find((s) => s.id === ownStaffId)?.name ??
    t("window.deleteAuthorFallback");
  const rangeInvalid = Boolean(from && to && to < from);
  const dates = from && to && !rangeInvalid ? eachDay(from, to) : [];

  const handleSubmit = async () => {
    if (dates.length === 0) return;
    setSaving(true);
    try {
      if (mode === "add") {
        const hours: DayHours = [{ from: hoursFrom, to: hoursTo }];
        await setCells({
          staffIds: [staffId],
          dates,
          typeId: "work",
          hours,
          actorName,
        });
        toast.success(tc("states.saved"));
        onSaved();
        onOpenChange(false);
        return;
      }
      // F-01-126 «Готово, когда»: дни с записями удалить нельзя, пока записи не перенесены —
      // deleteCells без force бросает schedule_has_bookings; раньше повторный вызов с force:true
      // после простого подтверждения всё равно удалял дни вместе с записями (b3-m4, block). Теперь
      // это настоящий блок: диалог объясняет и закрывается, ничего не удаляется, days и bookings
      // остаются как были — переносить записи нужно вручную (в «Журнале» или «Записях»), затем
      // повторить удаление дней в этом же модальном окне.
      try {
        await deleteCells({ staffIds: [staffId], dates, actorName });
      } catch {
        const affected = await findAffectedBookings([staffId], dates);
        await confirm({
          title: t("grid.staffMenu.removeDaysBlockedTitle"),
          description: t("grid.staffMenu.removeDaysWarning", {
            count: affected.length,
          }),
          tone: "danger",
          confirmLabel: t("grid.staffMenu.removeDaysConfirm"),
        });
        setSaving(false);
        return;
      }
      toast.success(tc("states.saved"));
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error(tc("states.actionFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        mode === "add"
          ? t("grid.staffMenu.addDaysTitle", { name: staffName })
          : t("grid.staffMenu.removeDaysTitle", { name: staffName })
      }
      size="sm"
    >
      <div className="flex flex-col gap-4" data-f="F-02-028">
        <div className="grid grid-cols-2 gap-2">
          <FormField label={t("grid.staffMenu.dateFrom")}>
            <DatePicker value={from} onValueChange={setFrom} />
          </FormField>
          <FormField
            label={t("grid.staffMenu.dateTo")}
            error={rangeInvalid ? t("grid.staffMenu.rangeError") : undefined}
          >
            <DatePicker value={to} onValueChange={setTo} invalid={rangeInvalid} />
          </FormField>
        </div>

        {mode === "add" && (
          <div className="grid grid-cols-2 gap-2">
            <FormField label={t("header.addStaff.from")}>
              <TimePicker value={hoursFrom} onValueChange={setHoursFrom} step={5} />
            </FormField>
            <FormField label={t("header.addStaff.to")}>
              <TimePicker value={hoursTo} onValueChange={setHoursTo} step={5} />
            </FormField>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("actions.cancel")}
          </Button>
          <Button
            type="button"
            variant={mode === "remove" ? "danger" : "primary"}
            loading={saving}
            disabled={dates.length === 0}
            onClick={handleSubmit}
          >
            {mode === "add"
              ? t("grid.staffMenu.addDays")
              : t("grid.staffMenu.removeDays")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
