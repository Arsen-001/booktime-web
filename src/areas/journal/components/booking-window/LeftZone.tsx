"use client";

/**
 * Окно записи → левая зона (F-01-042…045, F-01-047…049).
 * У сохранённой записи параметры свёрнуты в серую карточку — «✎ Изменить» раскрывает мастера, дату,
 * время/длительность, перерыв (F-01-047). У закреплённых полей (F-01-048) сюда же выносится сам
 * редактор — рендерит вызывающий компонент через renderPinnedField.
 */
import { useState, type ReactNode } from "react";
import { ClipboardList, FileText, Pencil, Trash2 } from "lucide-react";
import type { Id, ISODate, Resource, Staff, TimeHM, Workplace } from "@/domain/core";
import { useSphere } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { fromMinutes, toMinutes } from "@/lib/date";
import { cn } from "@/lib/cn";
import { MAX_DURATION_MIN, MIN_DURATION_MIN } from "@/areas/journal/lib/grid";
import {
  MedicalCardModal,
  MedicalVisitCard,
  TreatmentPlanModal,
} from "@/areas/journal/components/booking-window/MedicalRecordsPanel";
import { ResourcesField } from "@/areas/journal/components/booking-window/ResourcesField";
import { Button } from "@/ui/Button";
import { DatePicker } from "@/ui/DatePicker";
import { FormField } from "@/ui/FormField";
import { IconButton } from "@/ui/IconButton";
import { Select } from "@/ui/Select";
import { TimePicker } from "@/ui/TimePicker";

const BREAK_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

export interface LeftZoneProps {
  isEdit: boolean;
  staff: Staff | undefined;
  staffList: Staff[];
  onStaffChange: (id: string) => void;
  workplace: Workplace;
  onWorkplaceChange: (w: Workplace) => void;
  date: ISODate;
  onDateChange: (d: ISODate) => void;
  time: TimeHM;
  onTimeChange: (t: TimeHM) => void;
  durationMin: number;
  onDurationChange: (m: number) => void;
  breakMin: number;
  onBreakChange: (m: number) => void;
  onDelete?: () => void;
  deleting?: boolean;
  pinnedFields: string[];
  renderPinnedField: (key: string) => ReactNode;
  expandedTileActive: boolean;
  onToggleExpandedTile: () => void;
  /** F-01-100: плитка «Повторение записи» — только у сохранённой записи */
  onOpenRepeat?: () => void;
  /** F-01-096: плитка «История изменений» — только у сохранённой записи */
  onOpenHistory?: () => void;
  /** F-01-179: без права «Изменять сотрудника и время записи» — мастер/дата/время закрыты */
  lockSchedule?: boolean;
  /** F-01-179: без права «Изменять длительность» — длительность закрыта */
  lockDuration?: boolean;
  /** F-01-189…191: медицинские сферы — id записи, клиента и его имя (undefined — блок скрыт) */
  bookingId?: Id;
  clientId?: Id;
  clientName?: string;
  authorName?: string;
  /** F-01-046: ресурсы локации; пусто — блок не рисуется */
  resources?: Resource[];
  resourceIds?: Id[];
  onResourceIdsChange?: (ids: Id[]) => void;
  occupiedResourceInstanceIds?: Set<Id>;
  /**
   * F-00-017/048, F-01-042: место «Дома» ставит себе только сам мастер — администратор и владелец
   * не могут записать мастера на дом (это обходило бы его собственную подписку индивидуала).
   * false — вариант "home" скрыт из выбора места.
   */
  canPickHomeWorkplace?: boolean;
}

const DURATION_STEPS: number[] = (() => {
  const out: number[] = [];
  for (let m = 5; m <= 145; m += 5) out.push(m);
  return out;
})();

export function LeftZone({
  isEdit,
  staff,
  staffList,
  onStaffChange,
  workplace,
  onWorkplaceChange,
  date,
  onDateChange,
  time,
  onTimeChange,
  durationMin,
  onDurationChange,
  breakMin,
  onBreakChange,
  onDelete,
  deleting,
  pinnedFields,
  renderPinnedField,
  expandedTileActive,
  onToggleExpandedTile,
  onOpenRepeat,
  onOpenHistory,
  lockSchedule = false,
  lockDuration = false,
  bookingId,
  clientId,
  clientName,
  authorName,
  resources = [],
  resourceIds = [],
  onResourceIdsChange,
  occupiedResourceInstanceIds,
  canPickHomeWorkplace = true,
}: LeftZoneProps) {
  const t = useT("journal");
  const tc = useT("common");
  const format = useFormat();
  const [paramsOpen, setParamsOpen] = useState(!isEdit);
  const sphere = useSphere();
  const [medicalVisitOpen, setMedicalVisitOpen] = useState(false);
  const [medicalCardOpen, setMedicalCardOpen] = useState(false);
  const [treatmentPlanOpen, setTreatmentPlanOpen] = useState(false);
  const showMedicalVisit =
    sphere.has("medicalRecords") && isEdit && bookingId && clientId;
  const showMedicalCard = sphere.has("medicalRecords") && clientId;
  const showTreatmentPlan = sphere.has("treatmentPlan") && clientId;

  const end = fromMinutes(toMinutes(time) + durationMin);

  const params = (
    <div
      data-f="F-01-042 F-01-043 F-01-044 F-01-109 F-01-112 F-01-115 F-01-179"
      className="flex flex-col gap-3"
    >
      <FormField
        label={t("window.staff")}
        hint={lockSchedule ? t("window.left.scheduleLocked") : undefined}
      >
        <Select
          value={staff?.id ?? ""}
          onValueChange={onStaffChange}
          disabled={lockSchedule}
          options={staffList.map((s) => ({ value: s.id, label: s.name }))}
        />
      </FormField>

      {staff &&
        (() => {
          const workplaceOptions = staff.workplaces.filter(
            (w) => canPickHomeWorkplace || w !== "home",
          );
          if (workplaceOptions.length <= 1) return null;
          return (
            <FormField label={t("window.workplace")}>
              <Select
                value={workplace}
                onValueChange={(v) => onWorkplaceChange(v as Workplace)}
                options={workplaceOptions.map((w) => ({
                  value: w,
                  label: tc(`workplace.${w}`),
                }))}
              />
            </FormField>
          );
        })()}

      <FormField label={t("window.date")}>
        <DatePicker
          value={date}
          onValueChange={(d) => d && onDateChange(d)}
          disabled={lockSchedule}
        />
      </FormField>

      {/* @container: три поля в ряд — только когда левой зоне хватает ширины; в окне записи (~290px) три колонки
          резали «45 мин» до «4…» и «11:00» — там начало и конец в ряд, длительность ниже во всю ширину */}
      <div className="@container">
        <div className="grid grid-cols-2 gap-2 @min-[25rem]:grid-cols-3">
          <FormField label={t("window.time")}>
            <TimePicker
              value={time}
              onValueChange={onTimeChange}
              step={5}
              disabled={lockSchedule}
            />
          </FormField>
          <FormField label={t("window.timeEnd")}>
            <TimePicker
              value={end}
              step={5}
              disabled={lockDuration}
              onValueChange={(newEnd) => {
                const next = toMinutes(newEnd) - toMinutes(time);
                onDurationChange(
                  Math.min(MAX_DURATION_MIN, Math.max(MIN_DURATION_MIN, next)),
                );
              }}
            />
          </FormField>
          <FormField
            label={t("window.duration")}
            className="col-span-2 @min-[25rem]:col-span-1"
          >
            <Select
              value={String(durationMin)}
              onValueChange={(v) => onDurationChange(Number(v))}
              disabled={lockDuration}
              options={DURATION_STEPS.map((m) => ({
                value: String(m),
                label: format.duration(m),
              }))}
            />
          </FormField>
        </div>
      </div>

      <div data-f="F-01-045 F-02-062" className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fg">
          {t("block.breakTitle")}
        </span>
        {breakMin > 0 ? (
          <div className="flex items-center gap-2">
            <Select
              value={String(breakMin)}
              onValueChange={(v) => onBreakChange(Number(v))}
              options={BREAK_OPTIONS.map((m) => ({
                value: String(m),
                label: format.duration(m),
              }))}
              className="flex-1"
            />
            <IconButton
              icon={<Trash2 aria-hidden />}
              label={t("window.left.breakRemove")}
              variant="outline"
              onClick={() => onBreakChange(0)}
            />
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onBreakChange(10)}
          >
            + {t("window.left.breakAdd")}
          </Button>
        )}
      </div>

      {onResourceIdsChange && (
        <ResourcesField
          resources={resources}
          occupiedInstanceIds={occupiedResourceInstanceIds ?? new Set()}
          value={resourceIds}
          onChange={onResourceIdsChange}
          disabled={lockSchedule}
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {isEdit && !paramsOpen ? (
        <div
          data-f="F-01-047"
          className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2.5"
        >
          <div className="flex items-center gap-2">
            {onDelete && (
              <IconButton
                data-f="F-01-118 F-01-120 F-16-131"
                icon={<Trash2 aria-hidden />}
                label={tc("actions.delete")}
                size="sm"
                disabled={deleting}
                onClick={onDelete}
              />
            )}
            <div className="text-sm">
              <p className="font-medium text-fg">{staff?.name}</p>
              <p className="text-muted">
                {format.date(date, "short")}, {time}–{end} ·{" "}
                {format.duration(durationMin)}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<Pencil aria-hidden />}
            onClick={() => setParamsOpen(true)}
          >
            {t("window.left.collapsedEdit")}
          </Button>
        </div>
      ) : (
        params
      )}

      {pinnedFields.length > 0 && (
        <div
          data-f="F-01-048"
          className="flex flex-col gap-4 border-t border-border pt-4"
        >
          {pinnedFields.map((key) => (
            <div key={key}>{renderPinnedField(key)}</div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onToggleExpandedTile}
        className={cn(
          "flex min-h-11 items-center justify-between rounded-xl border border-border px-3.5 text-sm font-medium transition-colors",
          expandedTileActive
            ? "bg-surface-3 text-fg"
            : "text-muted hover:bg-surface-2 hover:text-fg",
        )}
      >
        {t("window.left.expandedTile")}
      </button>

      {/* F-01-100: у несохранённой записи плитка недоступна — сначала нужно сохранить (Готово-критерий) */}
      <div className="flex flex-col gap-1">
        <button
          type="button"
          data-f="F-01-100"
          disabled={!onOpenRepeat}
          onClick={onOpenRepeat}
          className={cn(
            "flex min-h-11 w-full items-center justify-between rounded-xl border border-border px-3.5 text-sm font-medium transition-colors",
            onOpenRepeat
              ? "text-muted hover:bg-surface-2 hover:text-fg"
              : "cursor-not-allowed text-muted/50",
          )}
        >
          {t("window.repeat.tile")}
        </button>
        {!onOpenRepeat && (
          <p className="px-1 text-xs text-muted">
            {t("window.repeat.needSaveFirst")}
          </p>
        )}
      </div>

      {onOpenHistory && (
        <button
          type="button"
          data-f="F-01-096"
          onClick={onOpenHistory}
          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border px-3.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          {t("window.history.tile")}
        </button>
      )}

      {/* F-01-189…191: только медицинские сферы (F-00-145) — плитки открывают заключение по
          визиту, медкарту и планы лечения пациента */}
      {(showMedicalVisit || showMedicalCard || showTreatmentPlan) && (
        <div className="flex flex-col gap-1">
          {showMedicalVisit && !medicalVisitOpen && (
            <button
              type="button"
              onClick={() => setMedicalVisitOpen(true)}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border px-3.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <span className="flex items-center gap-2">
                <FileText aria-hidden className="size-4" />
                {t("window.medical.visitTitle")}
              </span>
            </button>
          )}
          {showMedicalCard && (
            <button
              type="button"
              onClick={() => setMedicalCardOpen(true)}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border px-3.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <span className="flex items-center gap-2">
                <ClipboardList aria-hidden className="size-4" />
                {t("window.medical.cardTitle")}
              </span>
            </button>
          )}
          {showTreatmentPlan && (
            <button
              type="button"
              onClick={() => setTreatmentPlanOpen(true)}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border px-3.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <span className="flex items-center gap-2">
                <ClipboardList aria-hidden className="size-4" />
                {t("window.medical.planTitle")}
              </span>
            </button>
          )}
        </div>
      )}

      {showMedicalVisit && medicalVisitOpen && bookingId && (
        <MedicalVisitCard
          bookingId={bookingId}
          clientName={clientName ?? ""}
          authorName={authorName ?? ""}
          onHide={() => setMedicalVisitOpen(false)}
        />
      )}

      {showMedicalCard && clientId && (
        <MedicalCardModal
          open={medicalCardOpen}
          onOpenChange={setMedicalCardOpen}
          clientId={clientId}
          clientName={clientName ?? ""}
        />
      )}

      {showTreatmentPlan && clientId && (
        <TreatmentPlanModal
          open={treatmentPlanOpen}
          onOpenChange={setTreatmentPlanOpen}
          clientId={clientId}
          clientName={clientName ?? ""}
        />
      )}
    </div>
  );
}
