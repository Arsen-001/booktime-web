'use client';

/**
 * /platform/ideas — очередь идей (F-00-009, наша сторона): «Предложить идею» ставится в кабинете бизнеса;
 * здесь — голоса и статус, «Сделано» уведомляет автора.
 */
import { useState } from 'react';
import { Lightbulb, ThumbsUp } from 'lucide-react';
import { TabCountSkeleton } from '@/areas/platform/components/TabCountSkeleton';
import { useIdeas } from '@/areas/platform/hooks/usePlatformData';
import { IdeaSheet } from '@/areas/platform/ideas/IdeaSheet';
import { IDEA_TONE } from '@/areas/platform/lib/tones';
import type { Idea, IdeaStatus } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { Tabs } from '@/ui/Tabs';
import { ExitHold } from '@/ui/ExitHold';

const FILTERS: (IdeaStatus | 'all')[] = ['all', 'considering', 'inProgress', 'done'];

export function IdeasScreen() {
  const t = useT('platform');
  const fmt = useFormat();
  const q = useIdeas();
  const [status, setStatus] = useState<IdeaStatus | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const all = q.data ?? [];
  const rows = all.filter((i) => status === 'all' || i.status === status);
  const open = all.find((i) => i.id === openId);

  const columns: TableColumn<Idea>[] = [
    {
      id: 'text',
      header: t('ideas.textLabel'),
      mobile: 'title',
      width: '32rem',
      skeleton: (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">
            <SkeletonText width="34ch" />
          </span>
          <span className="truncate text-sm font-normal text-muted">
            <SkeletonText width="20ch" />
          </span>
        </span>
      ),
      // Одна строка текста идеи (полностью — в карточке): высота строки не зависит от длины идеи
      cell: (i) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">{i.text}</span>
          <span className="truncate text-sm font-normal text-muted">{i.authorName} · {fmt.ago(i.createdAt)}</span>
        </span>
      ),
    },
    {
      id: 'votes',
      header: t('ideas.votesLabel'),
      align: 'right',
      mobile: 'aside',
      sortable: true,
      sortValue: (i) => i.votes,
      width: '9rem',
      skeleton: (
        <span className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-fg">
          <ThumbsUp aria-hidden className="size-4 text-muted" />
          <SkeletonText width="7ch" />
        </span>
      ),
      cell: (i) => (
        <span className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-fg">
          <ThumbsUp aria-hidden className="size-4 text-muted" />
          {t('ideas.votes', { n: i.votes })}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('ideas.statusLabel'),
      align: 'right',
      mobile: 'badge',
      width: '10rem',
      cell: (i) => <Badge tone={IDEA_TONE[i.status]}>{t(`ideas.status.${i.status}`)}</Badge>,
      skeleton: (
        <Badge tone="neutral">
          <SkeletonText width="9ch" />
        </Badge>
      ),
    },
  ];

  return (
    <div data-f="F-00-009" className="flex flex-col gap-6">
      <PageHeader title={t('ideas.title')} description={t('ideas.subtitle')} />
      <Tabs
        value={status}
        onValueChange={(v) => setStatus(v as IdeaStatus | 'all')}
        items={FILTERS.map((s) => ({
          value: s,
          label: s === 'all' ? t('ideas.allStatuses') : t(`ideas.status.${s}`),
          badge: q.data ? <Badge size="sm" tone="neutral">{s === 'all' ? all.length : all.filter((i) => i.status === s).length}</Badge> : <TabCountSkeleton typical={9} />,
        }))}
      />
      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <Table
          label={t('ideas.title')}
          columns={columns}
          rows={rows}
          rowKey={(i) => i.id}
          loading={q.isLoading}
          // В демо — шесть идей
          loadingRows={6}
          onRowClick={(i) => setOpenId(i.id)}
          empty={
            status !== 'all' ? (
              <EmptyState kind="search" title={t('ideas.emptyFilter')} onReset={() => setStatus('all')} />
            ) : (
              <EmptyState icon={<Lightbulb aria-hidden />} title={t('ideas.empty')} description={t('ideas.emptyHint')} />
            )
          }
        />
      )}
      <ExitHold value={open}>{(open) => <IdeaSheet key={open.id} idea={open} onClose={() => setOpenId(null)} />}</ExitHold>
    </div>
  );
}
