'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { TimeHM } from '@/domain/core';
import {
  HOUR_PRESETS,
  SPLIT_PRESETS,
  addMinutesHM,
  checkDraft,
  hoursToDraft,
  nextBreak,
  shortHours,
  type HoursDraft,
} from '@/areas/schedule/lib/hours';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { TimePicker } from '@/ui/TimePicker';

export interface BreaksEditorProps {
  /** Черновик часов: неверное значение остаётся в поле с подписью, а не превращается молча в выходной (Г1) */
  value: HoursDraft;
  onChange: (draft: HoursDraft) => void;
  disabled?: boolean;
  /** Готовые варианты часов чипами над полями (ux-best-c1 №2) */
  presets?: boolean;
  /** Подпись поля часов (в шаблоне по дням недели — «Понедельник») */
  label?: string;
}

const sameDraft = (a: HoursDraft, b: HoursDraft) =>
  a.from === b.from &&
  a.to === b.to &&
  a.breaks.length === b.breaks.length &&
  a.breaks.every((x, i) => x.from === b.breaks[i].from && x.to === b.breaks[i].to);

/**
 * «Рабочее время» + «Перерыв» (F-02-012, F-02-013). Проверка на месте (Г1, Г5): «до» не раньше «с» (в списке «до»
 * время раньше «с» недоступно), перерыв внутри смены и без пересечений — ошибка красным под полем, строка не исчезает.
 * Пустые поля (Г17) — «—:—» с подсказкой выбрать часы.
 */
export function BreaksEditor({ value, onChange, disabled = false, presets = false, label }: BreaksEditorProps) {
  const t = useT('schedule');
  const check = checkDraft(value);
  const update = (patch: Partial<HoursDraft>) => onChange({ ...value, ...patch });
  const rangeError = check.range === 'endBeforeStart' ? t('panel.errEndBeforeStart') : undefined;
  const rangeHint = check.range === 'missing' ? t('panel.pickHoursHint') : undefined;
  const breakError = (i: number) => {
    const e = check.breaks[i];
    if (e === 'endBeforeStart') return t('panel.errBreakEnd');
    if (e === 'outside') return t('panel.errBreakOutside');
    if (e === 'overlap') return t('panel.errBreakOverlap');
    return undefined;
  };

  return (
    <div className="flex flex-col gap-4">
      <FormField label={label ?? t('panel.workHours')} error={rangeError} hint={rangeHint}>
        <div className="flex flex-col gap-3">
          {presets && (
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('panel.hourPresets')}>
              {HOUR_PRESETS.map((p) => (
                <Chip key={shortHours(p)} selected={sameDraft(value, hoursToDraft(p))} onClick={() => onChange(hoursToDraft(p))} disabled={disabled}>
                  {shortHours(p)}
                </Chip>
              ))}
              {SPLIT_PRESETS.map((p) => (
                <Chip
                  key={p.id}
                  selected={sameDraft(value, hoursToDraft(p.hours))}
                  onClick={() => onChange(hoursToDraft(p.hours))}
                  disabled={disabled}
                >
                  {p.id === 'day' ? t('panel.splitDay', { hours: shortHours(p.hours) }) : t('panel.splitEvening', { hours: shortHours(p.hours) })}
                </Chip>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <TimePicker
              className="min-w-0 flex-1 basis-28"
              value={value.from}
              onValueChange={(v) => update({ from: v })}
              min="00:00"
              max="23:45"
              placeholder="—:—"
              invalid={Boolean(rangeError)}
              disabled={disabled}
            />
            <span className="text-muted" aria-hidden>
              –
            </span>
            <TimePicker
              className="min-w-0 flex-1 basis-28"
              value={value.to}
              onValueChange={(v) => update({ to: v })}
              min={value.from ? addMinutesHM(value.from, 15) : '00:15'}
              max="24:00"
              placeholder="—:—"
              invalid={Boolean(rangeError)}
              disabled={disabled}
            />
          </div>
        </div>
      </FormField>

      {value.breaks.map((b, i) => (
        <FormField key={i} label={t('panel.breakLabel')} error={breakError(i)}>
          <div className="flex flex-wrap items-center gap-2">
            <TimePicker
              className="min-w-0 flex-1 basis-28"
              value={b.from}
              min={(value.from ?? '00:00') as TimeHM}
              max={(value.to ?? '24:00') as TimeHM}
              invalid={Boolean(breakError(i))}
              onValueChange={(v) => update({ breaks: value.breaks.map((x, xi) => (xi === i ? { ...x, from: v } : x)) })}
              disabled={disabled}
            />
            <span className="text-muted" aria-hidden>
              –
            </span>
            <TimePicker
              className="min-w-0 flex-1 basis-28"
              value={b.to}
              min={addMinutesHM(b.from, 5)}
              max={(value.to ?? '24:00') as TimeHM}
              invalid={Boolean(breakError(i))}
              onValueChange={(v) => update({ breaks: value.breaks.map((x, xi) => (xi === i ? { ...x, to: v } : x)) })}
              disabled={disabled}
            />
            <IconButton
              icon={<Trash2 aria-hidden />}
              label={t('panel.removeBreak')}
              variant="ghost"
              onClick={() => update({ breaks: value.breaks.filter((_, xi) => xi !== i) })}
              disabled={disabled}
            />
          </div>
        </FormField>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        leftIcon={<Plus aria-hidden />}
        className="self-start"
        disabled={disabled || Boolean(check.range)}
        onClick={() => update({ breaks: [...value.breaks, nextBreak(value)] })}
      >
        {t('panel.addBreak')}
      </Button>
    </div>
  );
}
