"use client";

/**
 * F-01-025 · Выбор «Запись / Событие» при смешанном типе.
 * Появляется по клику на пустую ячейку, только когда тип журнала — «Смешанная» (у нас читается по
 * функции сферы sphereHas('groups'); настроечный экран F-01-167 в эту пачку не входит — см. assumed
 * в отчёте пачки b02). При «Индивидуальной» этот выбор не показывается вовсе.
 *
 * F-01-194 (пачка f2): «Событие» отсюда и прямой переход при типе журнала «Групповая» (см.
 * `startCreate()` в JournalScreen.tsx) — оба ведут на `/biz/groups?new=1&staff=…&start=…&date=…`,
 * окно создания события строит раздел `resources` (`EventCreateScreen`).
 *
 * F-02-036 (журнал хозяин экрана, функция числится за schedule): третий пункт «Перерыв» — ставит
 * перерыв сотруднику прямо на клик по пустому месту сетки (открывает StaffScheduleModal с готовым
 * интервалом на это время, F-02-013/026). Показывается, когда есть кому его задать (onChooseBreak
 * передан) — и при «Смешанной», и при «Индивидуальной» (в последней раньше выбора вообще не было,
 * клик сразу создавал запись).
 */
import { CalendarRange, Coffee, User } from "lucide-react";
import { useT } from "@/i18n/useT";
import { Modal } from "@/ui/Modal";

export interface MixedTypeChoiceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseRecord: () => void;
  /** Нет — тип журнала «Индивидуальная»: пункт «Событие» скрыт (F-01-025). */
  onChooseEvent?: () => void;
  /** F-02-036: нет — пустая ячейка не привязана к сотруднику (например ресурс), пункт скрыт. */
  onChooseBreak?: () => void;
}

export function MixedTypeChoice({
  open,
  onOpenChange,
  onChooseRecord,
  onChooseEvent,
  onChooseBreak,
}: MixedTypeChoiceProps) {
  const t = useT("journal");

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("mixedType.title")}
      description={t("mixedType.description")}
      size="sm"
    >
      <div data-f="F-01-025 F-01-194 F-02-036" className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onChooseRecord}
          className="flex min-h-16 items-center gap-3 rounded-xl border border-border px-4 text-left hover:border-primary hover:bg-primary-soft"
        >
          <User aria-hidden className="size-5 shrink-0 text-primary-text" />
          <span>
            <span className="block font-medium text-fg">
              {t("mixedType.record")}
            </span>
            <span className="block text-sm text-muted">
              {t("mixedType.recordHint")}
            </span>
          </span>
        </button>
        {onChooseEvent && (
          <button
            type="button"
            onClick={onChooseEvent}
            className="flex min-h-16 items-center gap-3 rounded-xl border border-border px-4 text-left hover:border-primary hover:bg-primary-soft"
          >
            <CalendarRange
              aria-hidden
              className="size-5 shrink-0 text-primary-text"
            />
            <span>
              <span className="block font-medium text-fg">
                {t("mixedType.event")}
              </span>
              <span className="block text-sm text-muted">
                {t("mixedType.eventHint")}
              </span>
            </span>
          </button>
        )}
        {onChooseBreak && (
          <button
            type="button"
            onClick={onChooseBreak}
            className="flex min-h-16 items-center gap-3 rounded-xl border border-border px-4 text-left hover:border-primary hover:bg-primary-soft"
          >
            <Coffee aria-hidden className="size-5 shrink-0 text-primary-text" />
            <span>
              <span className="block font-medium text-fg">
                {t("mixedType.break")}
              </span>
              <span className="block text-sm text-muted">
                {t("mixedType.breakHint")}
              </span>
            </span>
          </button>
        )}
      </div>
    </Modal>
  );
}
