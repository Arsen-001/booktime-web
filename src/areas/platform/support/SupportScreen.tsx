'use client';

/** /platform/support — одна очередь обращений из всех каналов (F-00-182): сначала те, кто ждёт нас; видно, что написали. */
import { useState } from 'react';
import { CircleCheck, LifeBuoy, Plus } from 'lucide-react';
import { useSupportTickets } from '@/areas/platform/hooks/usePlatformData';
import { SUPPORT_TONE } from '@/areas/platform/lib/tones';
import { NewTicketSheet } from '@/areas/platform/support/NewTicketSheet';
import { TicketSheet } from '@/areas/platform/support/TicketSheet';
import type { SupportChannel, SupportTicketView } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Fab } from '@/ui/Fab';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { Tabs } from '@/ui/Tabs';
import { ExitHold } from '@/ui/ExitHold';

const CHANNELS: SupportChannel[] = ['app', 'cabinet', 'phone', 'whatsapp', 'telegram', 'email'];

export function SupportScreen() {
  const t = useT('platform');
  const fmt = useFormat();
  const [tab, setTab] = useState<'active' | 'closed'>('active');
  const [channel, setChannel] = useState<SupportChannel | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const q = useSupportTickets(tab, channel);
  const open = q.data?.find((tk) => tk.id === openId);

  const columns: TableColumn<SupportTicketView>[] = [
    {
      id: 'who',
      header: t('support.fromLabel'),
      mobile: 'title',
      width: '30rem',
      skeleton: (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">
            <SkeletonText width="24ch" />
          </span>
          <span className="line-clamp-1 text-sm font-normal text-muted">
            <SkeletonText width="34ch" />
          </span>
        </span>
      ),
      cell: (tk) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">
            {tk.name}
            <span className="font-normal text-muted"> · {t(`support.topic.${tk.topic}`)}</span>
          </span>
          <span className="line-clamp-1 text-sm font-normal text-muted">{tk.lastMessage}</span>
        </span>
      ),
    },
    { id: 'channel', header: t('support.filterChannel'), mobile: 'hidden', width: '9rem', skeletonWidth: '9ch', cell: (tk) => <span className="block truncate">{t(`support.channel.${tk.channel}`)}</span> },
    {
      id: 'updated',
      header: t('support.updatedLabel'),
      mobile: 'aside',
      sortable: true,
      sortValue: (tk) => tk.updatedAt,
      width: '10rem',
      skeleton: (
        <span className="text-sm text-muted">
          <SkeletonText width="10ch" />
        </span>
      ),
      cell: (tk) => <span className="text-sm whitespace-nowrap text-muted">{fmt.ago(tk.updatedAt)}</span>,
    },
    {
      id: 'status',
      header: t('support.statusLabel'),
      mobile: 'badge',
      align: 'right',
      width: '9rem',
      skeleton: (
        <Badge tone="neutral">
          <SkeletonText width="7ch" />
        </Badge>
      ),
      cell: (tk) => <Badge tone={SUPPORT_TONE[tk.status]}>{t(`support.status.${tk.status}`)}</Badge>,
    },
  ];

  const addButton = (
    <Button className="max-md:hidden" leftIcon={<Plus aria-hidden />} onClick={() => setCreating(true)}>
      {t('support.newTicket')}
    </Button>
  );

  return (
    <div data-f="F-00-182 F-14-137" className="flex flex-col gap-6">
      <PageHeader title={t('support.title')} description={t('support.subtitle')} actions={addButton} />
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'active' | 'closed')}
        items={[
          { value: 'active', label: t('support.tabActive') },
          { value: 'closed', label: t('support.tabClosed') },
        ]}
      />
      <FilterBar
        actions={
          <Select
            aria-label={t('support.filterChannel')}
            value={channel}
            onValueChange={(v) => setChannel(v as SupportChannel | 'all')}
            options={[{ value: 'all', label: t('support.allChannels') }, ...CHANNELS.map((c) => ({ value: c, label: t(`support.channel.${c}`) }))]}
          />
        }
      />
      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <Table
          label={t('support.title')}
          columns={columns}
          rows={q.data ?? []}
          rowKey={(tk) => tk.id}
          loading={q.isLoading}
          // В демо — девять открытых обращений
          loadingRows={tab === 'active' ? 9 : 3}
          onRowClick={(tk) => setOpenId(tk.id)}
          empty={
            channel !== 'all' ? (
              <EmptyState kind="search" title={t('support.emptyFilter')} onReset={() => setChannel('all')} />
            ) : tab === 'active' ? (
              <EmptyState
                icon={<CircleCheck aria-hidden className="text-success" />}
                title={t('support.emptyActive')}
                description={t('support.emptyActiveHint')}
              />
            ) : (
              <EmptyState icon={<LifeBuoy aria-hidden />} title={t('support.emptyClosed')} />
            )
          }
        />
      )}
      <Fab icon={<Plus />} label={t('support.newTicket')} extended onClick={() => setCreating(true)} />
      <ExitHold value={creating}>{() => <NewTicketSheet onClose={() => setCreating(false)} />}</ExitHold>
      <ExitHold value={open}>{(open) => <TicketSheet key={open.id} ticket={open} onClose={() => setOpenId(null)} />}</ExitHold>
    </div>
  );
}
