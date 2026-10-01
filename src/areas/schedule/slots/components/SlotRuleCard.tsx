'use client';

/**
 * Одно правило окон — основное или исключение по дням недели (F-02-044, F-02-053, F-02-054, F-02-055).
 * Сводка плитками + «Изменить правила»; сетка окон — только в рабочие часы филиала (ux-r5 L-1: не 48 чёрных плашек
 * с 00:00), включённое окно — мягкий primary, выключенное — зачёркнутое.
 */
import { Pencil, Trash2 } from 'lucide-react';
import type { TimeRange } from '@/domain/core';
import type { DayPart, SlotRule } from '@/domain/schedule';
import { DAY_PARTS, groupByPart, windowGrid } from '@/areas/schedule/lib/slots';
import { RuleTile } from '@/areas/schedule/slots/components/RuleTile';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { toMinutes } from '@/lib/date';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { IconButton } from '@/ui/IconButton';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { SlotButton } from '@/ui/SlotButton';

export interface SlotRuleCardProps {
  rule: SlotRule;
  editable: boolean;
  /** Рабочие часы филиала/сотрудника — сетка показывает только их */
  workRange: TimeRange | null;
  onEdit: () => void;
  onDelete: () => void;
  onToggleSlot: (time: string) => void;
  onTogglePart: (times: string[], enable: boolean) => void;
  /**
   * Первая загрузка: та же карточка (DESIGN.md → «The skeleton IS the page») — значения плиток, счётчики и окна
   * полосами, кнопки неактивны. rule — основное правило по умолчанию, workRange — типичные часы (10:00–21:00).
   */
  loading?: boolean;
}

const PART_KEY: Record<DayPart, 'slots.rules.grid.morning' | 'slots.rules.grid.day' | 'slots.rules.grid.evening'> = {
  morning: 'slots.rules.grid.morning',
  day: 'slots.rules.grid.day',
  evening: 'slots.rules.grid.evening',
};

export function SlotRuleCard({ rule, editable, workRange, onEdit, onDelete, onToggleSlot, onTogglePart, loading = false }: SlotRuleCardProps) {
  const t = useT('schedule');
  const format = useFormat();
  const names = format.weekdaysShort();
  const manualAllowed = rule.startMode === 'from_window' && rule.density !== 'dynamic';
  const unlimited = rule.windowFrom === '00:00' && rule.windowTo === '24:00';
  const grid = windowGrid(rule).filter(
    (tm) =>
      !workRange ||
      (toMinutes(tm as TimeRange['from']) >= toMinutes(workRange.from) && toMinutes(tm as TimeRange['from']) < toMinutes(workRange.to)),
  );
  const byPart = groupByPart(grid);
  const disabled = new Set(rule.disabledSlots);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-fg">{rule.isBase ? t('slots.rules.base') : t('slots.rules.exception')}</span>
          <div className="flex flex-wrap gap-1" aria-label={t('templates.weekdays')}>
            {names.map((n, wd) => (
              <span
                key={wd}
                className={cn(
                  'grid size-8 place-items-center rounded-full text-xs font-semibold first-letter:uppercase',
                  rule.weekdays.includes(wd as 0) && !loading ? 'bg-primary-soft text-primary-text' : 'bg-surface-2 text-muted',
                )}
              >
                {n}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editable && (
            <Button size="sm" leftIcon={<Pencil aria-hidden />} onClick={onEdit} disabled={loading}>
              {t('slots.rules.editRules')}
            </Button>
          )}
          {editable && !rule.isBase && (
            <IconButton label={t('slots.rules.deleteRule')} icon={<Trash2 aria-hidden />} variant="ghost" onClick={onDelete} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <RuleTile
          label={t('slots.rules.densityTile')}
          value={loading ? <SkeletonText width="10ch" /> : t(`slots.wizard.density.${rule.density}` as 'slots.wizard.density.fixed')}
        />
        <RuleTile
          label={t('slots.rules.startTile')}
          value={
            loading ? (
              <SkeletonText width="14ch" />
            ) : rule.startMode === 'from_shift_start'
              ? t('slots.rules.startTileFromShift')
              : unlimited
                ? t('slots.rules.windowAll')
                : t('slots.rules.windowValue', { from: rule.windowFrom, to: rule.windowTo })
          }
        />
        <RuleTile label={t('slots.rules.stepTile')} value={loading ? <SkeletonText width="6ch" /> : format.duration(rule.stepMin)} />
        <RuleTile
          label={t('slots.rules.leadTile')}
          value={loading ? <SkeletonText width="11ch" /> : rule.leadTimeMin ? format.duration(rule.leadTimeMin) : t('slots.rules.leadNotSet')}
          muted={!rule.leadTimeMin}
        />
      </div>

      {manualAllowed ? (
        grid.length === 0 ? (
          <p className="text-sm text-muted">{t('slots.rules.noWorkHours')}</p>
        ) : (
          <div className="flex flex-col gap-4" data-f="F-03-063">
            {unlimited && workRange && (
              <p className="text-sm text-muted">
                {loading ? (
                  // Фраза в одну строку на широком экране и в две — на телефоне
                  <>
                    <span className="sm:hidden">
                      <Skeleton lines={2} />
                    </span>
                    <span className="max-sm:hidden">
                      <SkeletonText width="56ch" />
                    </span>
                  </>
                ) : (
                  t('slots.rules.shownWorkHours', { from: workRange.from, to: workRange.to })
                )}
              </p>
            )}
            {DAY_PARTS.map((part) => {
              const times = byPart[part];
              if (times.length === 0) return null;
              const onCount = times.filter((tm) => !disabled.has(tm)).length;
              return (
                <div key={part} className="flex flex-col gap-2">
                  <Checkbox
                    checked={!loading && onCount === times.length}
                    indeterminate={!loading && onCount > 0 && onCount < times.length}
                    onCheckedChange={(v) => editable && onTogglePart(times, v)}
                    disabled={!editable || loading}
                    label={
                      <span className="font-medium text-fg">
                        {t(PART_KEY[part])}{' '}
                        <span className="text-muted">
                          {loading ? <SkeletonText width="7ch" /> : `(${t('slots.rules.grid.count', { on: onCount, total: times.length })})`}
                        </span>
                      </span>
                    }
                  />
                  <div className="flex flex-wrap gap-2 sm:pl-8">
                    {times.map((tm) => {
                      const on = !disabled.has(tm);
                      return (
                        <SlotButton
                          key={tm}
                          aria-pressed={on}
                          disabled={!editable || loading}
                          className={
                            on ? undefined : 'border border-border bg-surface text-muted line-through hover:bg-surface-2 hover:text-fg'
                          }
                          onClick={() => onToggleSlot(tm)}
                          aria-label={`${tm}: ${on ? t('slots.rules.slotOn') : t('slots.rules.slotOff')}`}
                        >
                          {loading ? <SkeletonText width="4ch" /> : tm}
                        </SlotButton>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted">
          {rule.density === 'dynamic' ? t('slots.rules.manualUnavailableDynamic') : t('slots.rules.manualUnavailableShift')}
        </p>
      )}
    </div>
  );
}
