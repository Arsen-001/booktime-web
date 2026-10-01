'use client';

import { CalendarPlus, MoreHorizontal, PauseCircle, Trash2 } from 'lucide-react';
import type { Id } from '@/domain/core';
import type { SeriesRule } from '@/domain/schedule';
import { useApiMutation, useApiQuery } from '@/api/request';
import {
  cancelSeriesOccurrence,
  extendSeries,
  getSeriesOccurrences,
  restoreSeriesOccurrence,
  resumeSeries,
  stopSeries,
} from '@/api/schedule';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { nowDateTime } from '@/lib/date';
import { Badge } from '@/ui/Badge';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

/** Карточка серии (F-00-064): правило словами, ближайшие визиты, «⋯» — продлить / остановить (с «Отменить») */
export function SeriesCard({ rule, staffName, skeletonRows = 3 }: { rule: SeriesRule; staffName?: string; skeletonRows?: number }) {
  const t = useT('schedule');
  const format = useFormat();
  const toast = useToast();
  const occurrencesQuery = useApiQuery(['schedule', 'series-occurrences', rule.id], () => getSeriesOccurrences(rule.id));
  const cancel = useApiMutation(cancelSeriesOccurrence);
  const restore = useApiMutation(restoreSeriesOccurrence);
  const extend = useApiMutation(extendSeries);
  const stop = useApiMutation(() => stopSeries(rule.businessId, rule.id));
  const resume = useApiMutation(() => resumeSeries(rule.businessId, rule.id));
  const now = nowDateTime();
  const upcoming = (occurrencesQuery.data ?? []).filter((b) => b.start >= now);

  const undo = (title: string, fn: () => Promise<unknown>) =>
    toast.show({
      title,
      tone: 'success',
      durationMs: 5000,
      action: {
        label: t('panel.undo'),
        onClick: () =>
          void fn().then(
            () => toast.info(t('panel.undone')),
            () => toast.error(t('calendar.actionFailed')),
          ),
      },
    });

  const cancelOne = async (bookingId: Id) => {
    try {
      await cancel.mutate(bookingId);
      undo(t('series.occurrenceCancelled'), () => restore.mutate(bookingId));
    } catch {
      toast.error(t('calendar.actionFailed'));
    }
  };

  const doExtend = async () => {
    try {
      const r = await extend.mutate(rule);
      toast.success(t('series.extended', { n: r.occurrences.length }));
    } catch {
      toast.error(t('calendar.actionFailed'));
    }
  };

  const doStop = async () => {
    try {
      await stop.mutate(undefined);
      undo(t('series.stopped'), () => resume.mutate(undefined));
    } catch {
      toast.error(t('calendar.actionFailed'));
    }
  };

  const ruleText =
    rule.kind === 'weekly' && rule.weekday !== undefined
      ? t('series.ruleWeekly', { day: format.weekdaysShort()[rule.weekday], time: rule.time })
      : t('series.ruleInterval', { n: rule.intervalDays ?? 7, time: rule.time });

  return (
    <SectionCard
      title={rule.clientName ?? t('series.noClientName')}
      description={staffName ? `${ruleText} · ${staffName}` : ruleText}
      actions={
        <div className="flex items-center gap-2">
          {!rule.active && <Badge tone="neutral">{t('series.stoppedLabel')}</Badge>}
          {rule.active && (
            <DropdownMenu
              label={rule.clientName ?? t('series.noClientName')}
              trigger={(p) => <IconButton {...p} icon={<MoreHorizontal aria-hidden />} label={t('series.menu')} variant="ghost" />}
              items={[
                { id: 'extend', label: t('series.extendButton'), icon: <CalendarPlus aria-hidden />, onSelect: () => void doExtend() },
                {
                  id: 'stop',
                  label: t('series.stopButton'),
                  icon: <PauseCircle aria-hidden />,
                  danger: true,
                  onSelect: () => void doStop(),
                },
              ]}
            />
          )}
        </div>
      }
    >
      {occurrencesQuery.isLoading ? (
        <OccurrencesSkeleton rows={skeletonRows} />
      ) : upcoming.length === 0 ? (
        <EmptyState variant="inline" title={t('series.noUpcoming')} />
      ) : (
        <ul className="flex flex-col divide-y divide-border" data-f="F-00-064">
          {upcoming.slice(0, 6).map((b) => (
            <li key={b.id} className="flex min-h-12 items-center justify-between gap-2">
              <span className="text-fg first-letter:uppercase">
                {format.relativeDay(b.start)}, {format.time(b.start)}
              </span>
              <IconButton
                icon={<Trash2 aria-hidden />}
                label={t('series.cancelOccurrenceAt', { when: format.dateTime(b.start) })}
                variant="ghost"
                onClick={() => cancelOne(b.id)}
                disabled={cancel.isPending}
              />
            </li>
          ))}
          {upcoming.length > 6 && <li className="py-2 text-sm text-muted">{t('series.moreUpcoming', { n: upcoming.length - 6 })}</li>}
        </ul>
      )}
    </SectionCard>
  );
}

/** Сколько визитов показывает карточка, дальше — строка «и ещё N» */
const SHOWN_UPCOMING = 6;

/** Ближайшие визиты при загрузке — те же строки 48px с корзиной; больше 6 — ещё строка «и ещё N» */
function OccurrencesSkeleton({ rows }: { rows: number }) {
  const t = useT('schedule');
  return (
    <ul aria-busy className="flex flex-col divide-y divide-border">
      {Array.from({ length: Math.min(rows, SHOWN_UPCOMING) }, (_, i) => (
        <li key={i} className="flex min-h-12 items-center justify-between gap-2">
          <span className="text-fg">
            <SkeletonText width={i % 2 ? '19ch' : '17ch'} />
          </span>
          <IconButton icon={<Trash2 aria-hidden />} label={t('series.menu')} variant="ghost" disabled />
        </li>
      ))}
      {rows > SHOWN_UPCOMING && (
        <li className="py-2 text-sm text-muted">
          <SkeletonText width="13ch" />
        </li>
      )}
    </ul>
  );
}

/**
 * Карточка серии при первой загрузке — та же SectionCard (DESIGN.md → «The skeleton IS the page»): имя клиента и
 * правило полосами, «⋯» на месте, визиты — строками (rows > 6 — ещё «и ещё N»).
 */
export function SeriesCardSkeleton({ rows }: { rows: number }) {
  const t = useT('schedule');
  return (
    <SectionCard
      title={<SkeletonText width="13ch" />}
      description={<SkeletonText width="30ch" />}
      actions={
        <div className="flex items-center gap-2">
          <IconButton icon={<MoreHorizontal aria-hidden />} label={t('series.menu')} variant="ghost" disabled />
        </div>
      }
    >
      <OccurrencesSkeleton rows={rows} />
    </SectionCard>
  );
}

/** Визитов в скелетоне карточки i — типичные серии демо: еженедельная (6 и «и ещё»), раз в 3 недели (3) */
export function seriesSkeletonRows(i: number): number {
  return i === 0 ? SHOWN_UPCOMING + 1 : 3;
}
