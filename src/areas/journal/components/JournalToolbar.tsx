"use client";

/**
 * Настройки вида сетки (F-01-014 статусы, F-01-015 шаг, F-01-133 перерыв, F-01-132 деление по ресурсам).
 * Раньше — ряды селектов над сеткой; в журнале A2 (DESIGN.md) живут в «⋯ Ещё» → «Вид сетки»: функции те же,
 * экран не загромождают. Сам ряд управления (даты, вид, мастера) — JournalDateNav / MastersPicker в JournalScreen.
 */
import type { BookingStatus } from "@/domain/core";
import type { JournalZoomMin } from "@/domain/journal";
import { useCan } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { useBookingStatusLabel } from "@/ui/BookingStatusBadge";
import { Checkbox } from "@/ui/Checkbox";
import { SegmentedControl } from "@/ui/SegmentedControl";

export type JournalView = "day" | "week" | "month";

/**
 * F-01-014 ⭐: 8 статусов из ядра (`BookingStatus`), а не только 4 статуса Altegio; метки — общая карта
 * `common.bookingStatus` (одни и те же слова во всех разделах).
 */
const FILTER_STATUSES: BookingStatus[] = [
  "awaiting_confirmation",
  "awaiting_prepayment",
  "scheduled",
  "client_confirmed",
  "arrived",
  "no_show",
  "cancelled_by_client",
  "cancelled_by_master",
];

export interface JournalGridSettingsProps {
  hiddenStatuses: string[];
  onHiddenStatusesChange: (statuses: string[]) => void;
  zoomMin: JournalZoomMin;
  onZoomChange: (zoom: JournalZoomMin) => void;
  breakCombineMode: "longest" | "sum";
  onBreakCombineModeChange: (mode: "longest" | "sum") => void;
  splitByResourceEnabled: boolean;
  onSplitByResourceChange: (enabled: boolean) => void;
  canEditSchedule: boolean;
}

function Label({ children }: { children: string }) {
  return <p className="text-sm font-medium text-fg">{children}</p>;
}

export function JournalGridSettings({
  hiddenStatuses,
  onHiddenStatusesChange,
  zoomMin,
  onZoomChange,
  breakCombineMode,
  onBreakCombineModeChange,
  splitByResourceEnabled,
  onSplitByResourceChange,
  canEditSchedule,
}: JournalGridSettingsProps) {
  const t = useT("journal");
  const statusLabel = useBookingStatusLabel();
  // Перерыв визита и «Делить запись по ресурсам» — настройки всего салона (F-01-174/175): их меняет тот, у кого
  // settings.manage, как на странице «Цифровой журнал»; статусы и шаг сетки — личные, остаются всем
  const canSalonSettings = useCan("settings.manage");

  const toggleStatus = (status: BookingStatus) => {
    const set = new Set(hiddenStatuses);
    if (set.has(status)) set.delete(status);
    else set.add(status);
    onHiddenStatusesChange([...set]);
  };

  return (
    <div data-f="F-01-014 F-01-015" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label>
          {hiddenStatuses.length > 0
            ? `${t("toolbar.statusFilter")} (${FILTER_STATUSES.length - hiddenStatuses.length}/${FILTER_STATUSES.length})`
            : t("toolbar.statusFilter")}
        </Label>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          {FILTER_STATUSES.map((status) => (
            <Checkbox
              key={status}
              label={statusLabel(status)}
              checked={!hiddenStatuses.includes(status)}
              onCheckedChange={() => toggleStatus(status)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t("scale.multiplicityHint")}</Label>
        <SegmentedControl
          size="sm"
          aria-label={t("scale.multiplicityHint")}
          value={String(zoomMin)}
          onValueChange={(v) => onZoomChange(Number(v) as JournalZoomMin)}
          options={[5, 10, 15].map((m) => ({ value: String(m), label: t("toolbar.zoomOption", { m }) }))}
        />
      </div>

      {canSalonSettings && (
        <div data-f="F-01-133" className="flex flex-col gap-1.5">
          <Label>{t("block.breakTitle")}</Label>
          <SegmentedControl
            size="sm"
            aria-label={t("block.breakTitle")}
            value={breakCombineMode}
            onValueChange={(v) => onBreakCombineModeChange(v as "longest" | "sum")}
            options={[
              { value: "longest", label: t("toolbar.breakMode.longest") },
              { value: "sum", label: t("toolbar.breakMode.sum") },
            ]}
          />
        </div>
      )}

      {canEditSchedule && canSalonSettings && (
        <span data-f="F-01-132" className="flex items-center">
          <Checkbox
            label={t("toolbar.splitByResource")}
            checked={splitByResourceEnabled}
            onCheckedChange={(v) => onSplitByResourceChange(Boolean(v))}
          />
        </span>
      )}
    </div>
  );
}
