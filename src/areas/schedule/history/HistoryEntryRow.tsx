'use client';

import type { HistoryEntry } from '@/domain/schedule';
import { dayTypeById } from '@/domain/schedule';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { useTDynamic } from '@/i18n/useTDynamic';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

const ACTION_TONE: Record<HistoryEntry['action'], BadgeTone> = {
  set_hours: 'neutral',
  apply_template: 'success',
  delete_days: 'danger',
  copy_schedule: 'info',
  set_mode: 'warning',
  toggle_mark: 'neutral',
  set_column_config: 'neutral',
  slot_rules: 'info',
};

export interface HistoryEntryRowProps {
  entry: HistoryEntry;
  /** Имена сотрудников, чей график правили */
  targets: string;
  /** Автор — это смотрящий: показываем «Вы» */
  isMe: boolean;
}

/**
 * Строка истории (F-02-102, ux-r5 H-1, recheck-c2): «Ани Саргсян · 10:00–19:00 → 10:00–22:00», кто и когда словами
 * («сегодня, 14:05») по Еревану, тип дня — из словаря, а не служебное «work».
 */
export function HistoryEntryRow({ entry, targets, isMe }: HistoryEntryRowProps) {
  const t = useT('schedule');
  const tc = useT('common');
  const tDyn = useTDynamic();
  const format = useFormat();
  const d = entry.details;

  const minutes = (v?: string) => (v === undefined ? '' : v === '0' ? t('slots.buffer.none') : t('slots.buffer.minutes', { n: Number(v) }));
  const what = (() => {
    if (!d) return entry.summary;
    if (entry.action === 'set_mode') return d.mode === 'busy' ? t('calendar.modeBusyShort') : t('calendar.modeFreeShort');
    if (entry.action === 'slot_rules') {
      const label = t(`history.what.${d.what ?? 'rule'}` as 'history.what.rule');
      if (d.what === 'buffer') return `${label}: ${minutes(d.before)} → ${minutes(d.after)}`;
      if (d.what === 'own_rules') return `${label}: ${d.after === 'own' ? t('slots.mode.own') : t('slots.mode.location')}`;
      if (d.what === 'slot' && d.after) return `${label}: ${d.after}`;
      return label;
    }
    if (d.before !== undefined && d.after !== undefined) return t('history.changed', { before: d.before, after: d.after });
    if (!d.typeId) return t('history.days', { days: d.days ?? 0 });
    return t('history.bulk', { type: tDyn(`schedule.${dayTypeById(d.typeId).labelKey}`), days: d.days ?? 0 });
  })();
  // Дата правки дня: «пн, 29 сентября» (recheck-c3: в строке должно быть видно, какой день правили)
  const when =
    entry.dates.length === 1
      ? format.date(entry.dates[0], 'weekday')
      : entry.dates.length === 2 && entry.action === 'slot_rules'
        ? `${format.date(entry.dates[0], 'dayMonth')}–${format.date(entry.dates[1], 'dayMonth')}`
        : '';
  const who = entry.actorName || (d?.role ? tc(`role.${d.role}` as never) : '');

  return (
    <li className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-fg">
          <span className="font-medium">{targets || t('history.wholeBranch')}</span>
          {when && <span className="text-muted"> · {when}</span>}
          {what && <span className="text-muted"> · {what}</span>}
        </p>
        <p className="text-sm text-muted first-letter:uppercase">
          {isMe ? t('history.you') : who} · {format.relativeDay(entry.at.slice(0, 10))}, {format.time(entry.at.slice(0, 16))}
        </p>
      </div>
      <Badge tone={ACTION_TONE[entry.action]} className="self-start sm:self-center">
        {t(`history.actions.${entry.action}` as 'history.actions.set_hours')}
      </Badge>
    </li>
  );
}

/** Какие строки истории на телефоне в две строки — типичная история демо (длинные «до → после» переносятся) */
const PHONE_TWO_LINES = [true, false, true, false, false, true];

/** Строка истории при загрузке — та же рамка и две строки текста, значок действия на своём месте */
export function HistoryEntryRowSkeleton({ index }: { index: number }) {
  return (
    <li aria-hidden className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {/* На телефоне первая строка правки часто в две строки («Имя · день · 10:00–19:00 → 10:00–20:00») */}
        <p className="text-fg">
          {PHONE_TWO_LINES[index % PHONE_TWO_LINES.length] ? (
            <>
              <span className="sm:hidden">
                <Skeleton lines={2} />
              </span>
              <span className="max-sm:hidden">
                <SkeletonText width="34ch" />
              </span>
            </>
          ) : (
            <SkeletonText width="26ch" />
          )}
        </p>
        <p className="text-sm text-muted">
          <SkeletonText width="20ch" />
        </p>
      </div>
      <Badge tone="neutral" className="self-start sm:self-center">
        <SkeletonText width="5ch" />
      </Badge>
    </li>
  );
}
