"use client";

/**
 * Общая форма «часы дня + перерыв» — переиспользуется:
 *  - F-01-016 «Добавить сотрудника в расписание» (шапка журнала, несколько сотрудников);
 *  - F-01-020 «Изменить рабочее время» (меню по имени сотрудника, один сотрудник).
 * Пишет через setDayHours()/setCells() раздела schedule — свои записи в чужой срез не заводим.
 */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { DayHours, Id, ISODate, Staff } from "@/domain/core";
import { setDayHours } from "@/api/schedule";
import { useCurrent } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { IconButton } from "@/ui/IconButton";
import { FormField } from "@/ui/FormField";
import { Modal } from "@/ui/Modal";
import { TimePicker } from "@/ui/TimePicker";
import { useToast } from "@/ui/Toast";

export interface StaffScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: ISODate;
  staffList: Staff[];
  /** F-01-020: один сотрудник, уже выбран — без чекбоксов выбора */
  fixedStaffId?: Id;
  onSaved: () => void;
  /**
   * F-02-036: часы дня уже есть (клик по пустой ячейке журнала) — форма стартует с них, а не с
   * заглушки 10:00–22:00, иначе сохранение стёрло бы реальный рабочий день. Полосы-перерывы внутри
   * `initialHours` (разрывы между интервалами) разворачиваются обратно в список `breaks`.
   */
  initialHours?: DayHours;
  /** F-02-036: время клика — сразу подставляется как начало нового перерыва (30 минут по умолчанию). */
  initialBreakStart?: string;
}

export function StaffScheduleModal({
  open,
  onOpenChange,
  date,
  staffList,
  fixedStaffId,
  onSaved,
  initialHours,
  initialBreakStart,
}: StaffScheduleModalProps) {
  const t = useT("journal");
  const tc = useT("common");
  const toast = useToast();
  const { staffId: ownStaffId } = useCurrent();
  const [selected, setSelected] = useState<Id[]>(
    fixedStaffId ? [fixedStaffId] : [],
  );
  const sortedInitial = [...(initialHours ?? [])].sort((a, b) =>
    a.from.localeCompare(b.from),
  );
  const [from, setFrom] = useState(sortedInitial[0]?.from ?? "10:00");
  const [to, setTo] = useState(
    sortedInitial[sortedInitial.length - 1]?.to ?? "22:00",
  );
  const [breaks, setBreaks] = useState<{ from: string; to: string }[]>(() => {
    const gaps: { from: string; to: string }[] = [];
    for (let i = 1; i < sortedInitial.length; i++) {
      if (sortedInitial[i - 1].to < sortedInitial[i].from) {
        gaps.push({ from: sortedInitial[i - 1].to, to: sortedInitial[i].from });
      }
    }
    if (initialBreakStart) {
      const [h, m] = initialBreakStart.split(":").map(Number);
      const endMinutes = h * 60 + m + 30;
      const endStr = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
      gaps.push({ from: initialBreakStart, to: endStr });
    }
    return gaps;
  });
  const [saving, setSaving] = useState(false);

  const toggle = (id: Id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleSave = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    try {
      // Перерывы вырезаются из общего интервала простым разбиением — F-01-016 нужен только сам факт
      // «сотрудник в расписании с указанным перерывом», без полного алгоритма пересечений границ.
      const validBreaks = breaks
        .filter((b) => b.from && b.to)
        .sort((a, b) => a.from.localeCompare(b.from));
      const hours: DayHours =
        validBreaks.length === 0
          ? [{ from, to }]
          : validBreaks.reduce<DayHours>((acc, b, i, arr) => {
              const prevEnd = i === 0 ? from : arr[i - 1].to;
              if (prevEnd < b.from) acc.push({ from: prevEnd, to: b.from });
              if (i === arr.length - 1 && b.to < to)
                acc.push({ from: b.to, to });
              return acc;
            }, []);
      const actorName =
        staffList.find((s) => s.id === ownStaffId)?.name ??
        t("window.deleteAuthorFallback");
      for (const staffId of selected) {
        await setDayHours(staffId, date, hours, actorName);
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
        fixedStaffId
          ? t("header.addStaff.editTitle")
          : t("header.addStaff.title")
      }
      size="sm"
    >
      <div
        data-f="F-01-016 F-02-024 F-02-026 F-02-036"
        className="flex flex-col gap-4"
      >
        {!fixedStaffId && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg">
              {t("header.addStaff.staffLabel")}
            </span>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-xl border border-border p-1.5">
              {staffList.map((s) => (
                <Checkbox
                  key={s.id}
                  label={s.name}
                  checked={selected.includes(s.id)}
                  onCheckedChange={() => toggle(s.id)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <FormField label={t("header.addStaff.from")}>
            <TimePicker value={from} onValueChange={setFrom} step={5} />
          </FormField>
          <FormField label={t("header.addStaff.to")}>
            <TimePicker value={to} onValueChange={setTo} step={5} />
          </FormField>
        </div>

        <div className="flex flex-col gap-1.5">
          {breaks.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <TimePicker
                value={b.from}
                onValueChange={(v) =>
                  setBreaks((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, from: v } : x)),
                  )
                }
                step={5}
              />
              <span className="text-muted">—</span>
              <TimePicker
                value={b.to}
                onValueChange={(v) =>
                  setBreaks((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, to: v } : x)),
                  )
                }
                step={5}
              />
              <IconButton
                icon={<Trash2 aria-hidden />}
                label={tc("actions.delete")}
                size="sm"
                onClick={() =>
                  setBreaks((prev) => prev.filter((_, j) => j !== i))
                }
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Plus aria-hidden />}
            onClick={() =>
              setBreaks((prev) => [...prev, { from: "14:00", to: "15:00" }])
            }
          >
            {t("header.addStaff.addBreak")}
          </Button>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tc("actions.cancel")}
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={selected.length === 0}
            onClick={handleSave}
          >
            {tc("actions.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
