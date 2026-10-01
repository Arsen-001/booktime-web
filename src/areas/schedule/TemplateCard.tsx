'use client';

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { ScheduleTemplate } from '@/domain/schedule';
import { dayBreaks } from '@/domain/rules';
import { spanText } from '@/areas/schedule/lib/hours';
import { templateAutoName } from '@/areas/schedule/lib/templateName';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Card } from '@/ui/Card';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';
import { SkeletonText } from '@/ui/Skeleton';

export interface TemplateCardProps {
  template: ScheduleTemplate;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Карточка шаблона (ux-r2 m-19, ux-best-c2 №6): мини-неделя «Пн Вт Ср…» (рабочие закрашены), часы словами
 * «10:00–19:00 · перерыв 14:00–15:00», правка — нажатием на карточку, удаление — в «⋯».
 */
export function TemplateCard({ template, canEdit, onEdit, onDelete }: TemplateCardProps) {
  const t = useT('schedule');
  const format = useFormat();
  const names = format.weekdaysShort();
  const title = template.name || templateAutoName(template, names, (w, o) => t('templates.shiftsName', { work: w, off: o }));
  const breaks = dayBreaks(template.hours);

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-fg">{title}</h3>
      </div>
      {template.kind === 'weekdays' ? (
        <div className="flex gap-1" aria-label={t('templates.weekdays')}>
          {names.map((n, i) => {
            const on = template.weekdays?.includes(i as 0) ?? false;
            return (
              <span
                key={i}
                className={cn(
                  'grid size-8 place-items-center rounded-full text-xs font-semibold first-letter:uppercase',
                  on ? 'bg-primary-soft text-primary-text' : 'bg-surface-2 text-muted line-through',
                )}
              >
                {n}
              </span>
            );
          })}
        </div>
      ) : template.name ? (
        <p className="text-sm text-muted">{t('templates.shiftsName', { work: template.shiftWork ?? 1, off: template.shiftOff ?? 0 })}</p>
      ) : null}
      <p className="text-sm text-fg">
        {spanText(template.hours)}
        {breaks.map((b) => (
          <span key={b.from} className="text-muted">
            {' '}
            · {t('calendar.breakShort', { from: b.from, to: b.to })}
          </span>
        ))}
      </p>
      {template.kind === 'weekdays' && template.weekdayHours && Object.keys(template.weekdayHours).length > 0 && (
        // Г10: свои часы отдельных дней — «сб 10:00–16:00»
        <p className="text-sm text-muted">
          {Object.entries(template.weekdayHours)
            .filter(([wd, h]) => h?.length && template.weekdays?.includes(Number(wd) as 0))
            .map(([wd, h]) => `${names[Number(wd)]} ${spanText(h ?? [])}`)
            .join(' · ')}
        </p>
      )}
    </>
  );

  if (!canEdit) return <Card className="flex flex-col gap-3 p-4">{body}</Card>;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onEdit}
        className="block w-full rounded-xl text-left focus-visible:outline-2 focus-visible:outline-focus"
      >
        <Card interactive className="flex flex-col gap-3 p-4 pr-14">
          {body}
        </Card>
      </button>
      <div className="absolute top-2 right-2">
        <DropdownMenu
          label={title}
          trigger={(p) => (
            <IconButton {...p} icon={<MoreHorizontal aria-hidden />} label={t('templatesPage.menuFor', { name: title })} variant="ghost" />
          )}
          items={[
            { id: 'edit', label: t('templatesPage.edit'), icon: <Pencil aria-hidden />, onSelect: onEdit },
            { id: 'delete', label: t('templatesPage.delete'), icon: <Trash2 aria-hidden />, danger: true, onSelect: onDelete },
          ]}
        />
      </div>
    </div>
  );
}

/**
 * Карточка шаблона при первой загрузке — та же разметка (DESIGN.md → «The skeleton IS the page»): название и часы
 * полосами в тех же строках; у шаблона «по дням недели» — те же семь кружков дней.
 */
export function TemplateCardSkeleton({ weekdays, canEdit }: { weekdays: boolean; canEdit: boolean }) {
  const t = useT('schedule');
  const format = useFormat();
  const names = format.weekdaysShort();
  return (
    <div aria-hidden className="relative">
      <Card className={cn('flex flex-col gap-3 p-4', canEdit && 'pr-14')}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-fg">
            <SkeletonText width={weekdays ? '18ch' : '19ch'} />
          </h3>
        </div>
        {weekdays && (
          <div className="flex gap-1">
            {names.map((n, i) => (
              <span key={i} className="grid size-8 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted first-letter:uppercase">
                {n}
              </span>
            ))}
          </div>
        )}
        <p className="text-sm text-fg">
          <SkeletonText width={weekdays ? '28ch' : '11ch'} />
        </p>
      </Card>
      {canEdit && (
        <div className="absolute top-2 right-2">
          <IconButton icon={<MoreHorizontal aria-hidden />} label={t('templatesPage.title')} variant="ghost" disabled />
        </div>
      )}
    </div>
  );
}
