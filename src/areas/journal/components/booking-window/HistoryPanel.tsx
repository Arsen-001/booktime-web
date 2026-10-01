'use client';

/**
 * Окно записи → плитка «История изменений» (F-01-096): кто, когда и что менял.
 * Есть только у сохранённой записи — вызывающий код (BookingWindow) не рендерит кнопку у черновика.
 */
import { History } from 'lucide-react';
import type { Id } from '@/domain/core';
import { getBookingHistory } from '@/api/journal';
import { useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { EmptyState } from '@/ui/EmptyState';
import { Skeleton } from '@/ui/Skeleton';

export interface HistoryPanelProps {
  bookingId: Id;
  onHide: () => void;
}

const ACTION_KEY: Record<string, string> = {
  created: 'window.history.action.created',
  updated: 'window.history.action.updated',
  statusChanged: 'window.history.action.statusChanged',
  deleted: 'window.history.action.deleted',
  restored: 'window.history.action.restored',
};

export function HistoryPanel({ bookingId, onHide }: HistoryPanelProps) {
  const t = useT('journal');
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const query = useApiQuery(['journal', 'history', bookingId], () => getBookingHistory(bookingId), {});

  return (
    <div data-f="F-01-096 F-04-138" className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-fg">{t('window.history.title')}</p>
        <button type="button" onClick={onHide} className="text-sm text-muted hover:text-fg">
          {t('window.right.hide')}
        </button>
      </div>

      {query.isLoading ? (
        <Skeleton lines={3} />
      ) : !query.data || query.data.length === 0 ? (
        <EmptyState icon={<History aria-hidden />} title={t('window.history.emptyTitle')} />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {query.data.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-0.5 border-b border-border pb-2.5 text-sm last:border-0 last:pb-0">
              <p className="text-fg">
                <span className="font-medium">{entry.authorName}</span>
                {' — '}
                {t(ACTION_KEY[entry.action] as never)}
                {' — '}
                {format.date(entry.at.slice(0, 10), 'short')}, {format.time(entry.at)}
              </p>
              <p className="text-muted">{entry.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
