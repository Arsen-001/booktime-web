"use client";

/**
 * F-01-058 · Строка услуги: количество, цена, скидка, итог.
 * У сохранённой записи строка рождается свёрнутой (заголовок + стрелка); у новой — сразу раскрыта.
 */
import { useState } from "react";
import { ChevronDown, Minus, Plus, Repeat, Trash2, UserPlus } from "lucide-react";
import type { Id, Staff } from "@/domain/core";
import { useCan } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { cn } from "@/lib/cn";
import type { UiServiceLine } from "@/areas/journal/lib/lineTotals";
import { REPEAT_REMINDER_OPTIONS, serviceLineTotal } from "@/areas/journal/lib/lineTotals";
import type { RepeatReminderCode } from "@/areas/journal/lib/lineTotals";
import { Badge } from "@/ui/Badge";
import { DropdownMenu, type DropdownMenuItem } from "@/ui/DropdownMenu";
import { IconButton } from "@/ui/IconButton";
import { Input } from "@/ui/Input";
import { MoneyInput } from "@/ui/MoneyInput";
import { Select } from "@/ui/Select";
import { Tooltip } from "@/ui/Tooltip";
import { DropdownChevron } from "@/ui/DropdownChevron";

export interface ServiceLineRowProps {
  line: UiServiceLine;
  defaultCollapsed?: boolean;
  onChange: (patch: Partial<UiServiceLine>) => void;
  onRemove: () => void;
  /** F-01-059: настройка ЗП «Оплачивать помощь в оказании услуги» — выключена, кнопка серая */
  assistantPayEnabled?: boolean;
  /** F-01-059: сотрудники, доступные как ассистенты (кроме основного мастера строки) */
  assistantOptions?: Staff[];
  /**
   * F-00-186 «Цепочка услуг у разных мастеров»: весь список мастеров записи, чтобы у КАЖДОЙ услуги
   * можно было выбрать своего исполнителя — одна запись, стрижка у одного, окрашивание у другого,
   * подряд. Нет списка или в нём один мастер — переключатель прячется, менять некого.
   */
  allStaffOptions?: Staff[];
  onChangeStaff?: (staffId: Id) => void;
}

export function ServiceLineRow({
  line,
  defaultCollapsed = false,
  onChange,
  onRemove,
  assistantPayEnabled = false,
  assistantOptions = [],
  allStaffOptions = [],
  onChangeStaff,
}: ServiceLineRowProps) {
  const t = useT("journal");
  const format = useFormat();
  const canEditPrice = useCan("journal.edit");
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const total = serviceLineTotal(line);
  const assistants = line.assistants ?? [];
  const currentStaff = allStaffOptions.find((s) => s.id === line.staffId);
  const canPickStaff = Boolean(onChangeStaff) && allStaffOptions.length > 1;

  function addAssistant(staffId: Id) {
    const evenShare = Math.round(100 / (assistants.length + 1));
    onChange({
      assistants: [...assistants, { staffId, sharePct: evenShare }],
    });
  }
  function removeAssistant(staffId: Id) {
    onChange({ assistants: assistants.filter((a) => a.staffId !== staffId) });
  }
  function changeShare(staffId: Id, sharePct: number) {
    onChange({
      assistants: assistants.map((a) =>
        a.staffId === staffId
          ? { ...a, sharePct: Math.min(100, Math.max(0, sharePct)) }
          : a,
      ),
    });
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-left text-sm hover:bg-surface-3"
      >
        <span className="min-w-0 truncate font-medium text-fg">
          {line.name}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-muted">
          {format.money(total)}
          <ChevronDown aria-hidden className="size-4" />
        </span>
      </button>
    );
  }

  return (
    <div
      data-f="F-01-131"
      // @container: колонки цены считаются от ширины окна записи, а не экрана — в средней зоне окна (~270px)
      // четыре поля по экрану сжимались до «400» вместо «4000»
      className="@container flex flex-col gap-3 rounded-xl border border-border bg-surface p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-fg">{line.name}</p>
          <p className="text-xs text-muted">
            {format.duration(line.durationMin)}
          </p>
        </div>
        <IconButton
          icon={<Trash2 aria-hidden />}
          label={t("window.serviceLine.remove")}
          size="sm"
          onClick={onRemove}
        />
      </div>

      {canPickStaff && (
        // F-01-137: журнал разрешает то, что запрещено онлайн-виджету, — разного мастера на каждой
        // строке визита (и пакет вместе с обычной услугой, см. PackageSiblingsPanel рядом).
        <div data-f="F-00-186 F-01-137">
          <DropdownMenu
            items={allStaffOptions.map(
              (s): DropdownMenuItem => ({
                id: s.id,
                label: s.name,
                onSelect: () => onChangeStaff?.(s.id),
              }),
            )}
            trigger={(props) => (
              <button
                {...props}
                type="button"
                className="flex min-h-9 w-fit items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 text-sm text-fg hover:bg-surface-3"
              >
                <Repeat aria-hidden className="size-3.5 text-muted" />
                {t("window.serviceLine.staffLabel", {
                  name: currentStaff?.name ?? t("window.serviceLine.staffUnknown"),
                })}
                <DropdownChevron open={props["aria-expanded"]} className="size-3.5" />
              </button>
            )}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-3 @md:grid-cols-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            {t("window.serviceLine.qty")}
          </span>
          <div className="flex items-center gap-1">
            <IconButton
              icon={<Minus aria-hidden />}
              label={t("window.serviceLine.qtyDec")}
              size="sm"
              variant="outline"
              disabled={line.qty <= 1}
              onClick={() => onChange({ qty: Math.max(1, line.qty - 1) })}
            />
            <span className="w-6 text-center font-medium tabular-nums">
              {line.qty}
            </span>
            <IconButton
              icon={<Plus aria-hidden />}
              label={t("window.serviceLine.qtyInc")}
              size="sm"
              variant="outline"
              onClick={() => onChange({ qty: line.qty + 1 })}
            />
          </div>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            {t("window.serviceLine.price")}
          </span>
          <MoneyInput
            min={0}
            value={line.unitPrice}
            disabled={!canEditPrice}
            onValueChange={(v) => onChange({ unitPrice: Math.max(0, v ?? 0) })}
          />
        </label>
        <label data-f="F-06-184 F-01-207" className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            {t("window.serviceLine.discount")}
          </span>
          <Input
            type="number"
            min={0}
            max={100}
            value={line.discountPct}
            disabled={!canEditPrice}
            onChange={(e) =>
              onChange({
                discountPct: Math.min(100, Math.max(0, Number(e.target.value))),
              })
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            {t("window.serviceLine.total")}
          </span>
          <MoneyInput
            min={0}
            value={total}
            disabled={!canEditPrice}
            onValueChange={(v) => {
              const nextTotal = Math.max(0, v ?? 0);
              const base = line.unitPrice * line.qty;
              const pct =
                base > 0
                  ? Math.min(
                      100,
                      Math.max(0, Math.round((1 - nextTotal / base) * 100)),
                    )
                  : 0;
              onChange({ discountPct: pct });
            }}
          />
        </label>
      </div>

      <div data-f="F-01-094" className="flex flex-col gap-1">
        <span className="text-xs text-muted">
          {t("window.serviceLine.repeatReminder")}
        </span>
        <Select
          value={line.repeatReminder ?? "none"}
          onValueChange={(v) =>
            onChange({
              repeatReminder:
                v === "none" ? undefined : (v as UiServiceLine["repeatReminder"]),
            })
          }
          disabled={!canEditPrice}
          options={[
            { value: "none", label: t("window.serviceLine.repeatReminderNone") },
            ...REPEAT_REMINDER_OPTIONS.map((code) => ({
              value: code,
              label: repeatReminderLabel(t, code),
            })),
          ]}
        />
      </div>

      <div data-f="F-01-059" className="flex flex-col gap-1.5">
        {assistants.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {assistants.map((a) => {
              const staff = assistantOptions.find((s) => s.id === a.staffId);
              return (
                <div
                  key={a.staffId}
                  className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm"
                >
                  <Badge tone="neutral" size="sm">
                    {staff?.name ?? a.staffId}
                  </Badge>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={a.sharePct}
                    onChange={(e) =>
                      changeShare(a.staffId, Number(e.target.value))
                    }
                    className="w-16"
                  />
                  <span className="text-xs text-muted">%</span>
                  <IconButton
                    icon={<Trash2 aria-hidden />}
                    label={t("window.serviceLine.assistantRemove")}
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => removeAssistant(a.staffId)}
                  />
                </div>
              );
            })}
          </div>
        )}
        {assistantPayEnabled ? (
          <DropdownMenu
            items={
              assistantOptions.filter(
                (s) => !assistants.some((a) => a.staffId === s.id),
              ).length === 0
                ? ([
                    {
                      id: "empty",
                      label: t("window.serviceLine.assistantNone"),
                      disabled: true,
                    },
                  ] as DropdownMenuItem[])
                : assistantOptions
                    .filter((s) => !assistants.some((a) => a.staffId === s.id))
                    .map(
                      (s): DropdownMenuItem => ({
                        id: s.id,
                        label: s.name,
                        onSelect: () => addAssistant(s.id),
                      }),
                    )
            }
            trigger={(props) => (
              <button
                {...props}
                type="button"
                className="flex min-h-9 w-fit items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-2.5 text-sm text-muted hover:bg-surface-2 hover:text-fg"
              >
                <UserPlus aria-hidden className="size-3.5" />
                {t("window.serviceLine.assistantAdd")}
                <DropdownChevron open={props["aria-expanded"]} className="size-3.5" />
              </button>
            )}
          />
        ) : (
          <Tooltip content={t("window.serviceLine.assistantDisabledHint")}>
            <button
              type="button"
              disabled
              className="flex min-h-9 w-fit cursor-not-allowed items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 text-sm text-muted/50"
            >
              <UserPlus aria-hidden className="size-3.5" />
              {t("window.serviceLine.assistantAdd")}
            </button>
          </Tooltip>
        )}
      </div>

      <label
        className={cn(
          "flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted",
        )}
      >
        {t("window.serviceLine.paid")}
        <span className="font-medium">{format.money(0)}</span>
      </label>
    </div>
  );
}

/** F-01-094: подпись варианта срока повторного визита — «через 7 дней» / «через 5 недель» / «через 2 мес.» */
function repeatReminderLabel(
  t: ReturnType<typeof useT<"journal">>,
  code: RepeatReminderCode,
): string {
  const n = Number(code.slice(1));
  if (code.startsWith("d")) return t("window.serviceLine.repeatReminderDays", { n });
  if (code.startsWith("w")) return t("window.serviceLine.repeatReminderWeeks", { n });
  return t("window.serviceLine.repeatReminderMonths", { n });
}
