'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { listDiaryEntries, removeDiaryEntry } from '@/api/client';
import type { DiaryRow } from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import type { Locale } from '@/i18n/config';
import { AddDiaryEntryModal } from '@/areas/client/diary/AddDiaryEntryModal';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { Skeleton } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';
import { useToast } from '@/ui/Toast';

/** Дневник клиента (F-00-122): визиты через приложение — сами, ручной расход — своей рукой */
export function DiaryScreen() {
  const t = useT('client');
  const { ready, appUserId } = useCurrent();

  if (!ready) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton variant="rect" className="h-10 w-40" />
        <Skeleton variant="rect" className="h-24 rounded-2xl" />
      </div>
    );
  }
  if (!appUserId) {
    return (
      <EmptyState
        icon={<BookOpen aria-hidden className="size-8 text-muted" />}
        title={t('diary.needLoginTitle')}
        description={t('diary.needLoginHint')}
        action={
          <LinkButton href="/login?next=/diary">{t('diary.goLogin')}</LinkButton>
        }
      />
    );
  }
  return <DiaryBody appUserId={appUserId} />;
}

function DiaryBody({ appUserId }: { appUserId: Id }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const locale = useLocale();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const q = useApiQuery(['diary', appUserId], () => listDiaryEntries(appUserId));
  const remove = useApiMutation(removeDiaryEntry);
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);

  const total = q.data?.reduce((sum, e) => sum + e.amount, 0) ?? 0;

  const handleRemove = async (id: Id) => {
    try {
      await remove.mutate(id);
      void q.refetch();
    } catch {
      toast.error(t('diary.removeFailed'));
    }
  };

  return (
    <div data-f="F-00-122" className="flex flex-col gap-5 pb-24">
      <PageHeader
        title={t('diary.title')}
        description={t('diary.subtitle')}
        actions={
          <Button leftIcon={<Plus aria-hidden />} onClick={() => setAddOpen(true)}>
            {t('diary.addCta')}
          </Button>
        }
      />

      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : q.isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton variant="rect" className="h-20 rounded-2xl" />
          <Skeleton variant="rect" className="h-16 rounded-xl" />
          <Skeleton variant="rect" className="h-16 rounded-xl" />
        </div>
      ) : !q.data?.length ? (
        <EmptyState
          icon={<BookOpen aria-hidden className="size-8 text-muted" />}
          title={t('diary.emptyTitle')}
          description={t('diary.emptyHint')}
          action={
            <Button variant="secondary" leftIcon={<Plus aria-hidden />} onClick={() => setAddOpen(true)}>
              {t('diary.addCta')}
            </Button>
          }
        />
      ) : (
        <>
          <StatCard label={t('diary.totalLabel')} value={fmt.money(total)} icon={<BookOpen aria-hidden />} />
          <div className="flex flex-col gap-2">
            {pageItems.map((row) => (
              <DiaryRowCard key={row.id} row={row} locale={locale} onRemove={() => void handleRemove(row.id)} removing={remove.isPending} />
            ))}
          </div>
          {pager}
        </>
      )}

      <AddDiaryEntryModal open={addOpen} onOpenChange={setAddOpen} appUserId={appUserId} onAdded={() => void q.refetch()} />
    </div>
  );
}

function DiaryRowCard({
  row,
  locale,
  onRemove,
  removing,
}: {
  row: DiaryRow;
  locale: Locale;
  onRemove: () => void;
  removing: boolean;
}) {
  const t = useT('client');
  const fmt = useClientFormat();
  const serviceName = row.source === 'app' ? (row.service ? pickText(row.service.name, locale) : t('bookings.serviceRemoved')) : row.serviceName;
  const masterName = row.source === 'app' ? row.staff?.name : row.masterName;

  return (
    <Card padding="sm" className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-3">
        {row.source === 'app' ? (
          <p data-f="F-00-173" className="min-w-0 flex-1 font-medium text-fg">
            {serviceName}
          </p>
        ) : (
          <p className="min-w-0 flex-1 font-medium text-fg">{serviceName}</p>
        )}
        <span className="shrink-0 font-medium text-fg">{fmt.money(row.amount)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm text-muted">
          {masterName ? `${masterName} · ` : ''}
          {fmt.date(row.date, 'long')}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {row.source === 'app' && (
            <Badge tone="primary" variant="soft">
              {t('diary.sourceApp')}
            </Badge>
          )}
          {row.removable && (
            <IconButton icon={<Trash2 aria-hidden />} label={t('diary.remove')} variant="ghost" size="sm" onClick={onRemove} disabled={removing} />
          )}
        </div>
      </div>
    </Card>
  );
}
