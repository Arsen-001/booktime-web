'use client';

/**
 * /biz/notifications/mailings — список рассылок (F-05-092 сводно) и правила/ограничения (F-05-095).
 */
import { useRouter } from 'next/navigation';
import { Megaphone, Plus, Send, Users } from 'lucide-react';
import { WEEKLY_PUSH_LIMIT, countRecentAppPushes, listMailings } from '@/api/notify';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';
import type { TableColumn } from '@/ui/Table';
import { Table } from '@/ui/Table';
import type { Mailing, MailingChannel } from '@/domain/notify';

const CHANNEL_LABEL: Record<MailingChannel, string> = {
  sms: 'SMS',
  pushOwnApp: 'Push · брендированное приложение',
  pushClientApp: 'Push · наше приложение',
};

/** Метка места числа во фразе правил — пока число грузится, на её месте полоса скелетона */
const USED_MARK = '\u2063';

export function MailingsListScreen() {
  const t = useT('notify');
  const format = useFormat();
  const router = useRouter();
  const { ready, businessId } = useCurrent();

  const q = useApiQuery(['notify', 'mailings', businessId], () => listMailings(businessId!), {
    enabled: ready && !!businessId,
  });
  const limitQ = useApiQuery(['notify', 'appPushLimit', businessId], () => countRecentAppPushes(businessId!), {
    enabled: ready && !!businessId,
  });

  const rows = q.data ?? [];
  const totalMailings = rows.length;
  const totalRecipients = rows.reduce((sum, row) => sum + row.recipientsCount, 0);
  const pushUsed = limitQ.data ?? 0;
  const statsLoading = !ready || q.isLoading;

  const columns: TableColumn<Mailing>[] = [
    {
      id: 'date',
      header: t('mailings.columns.date'),
      cell: (row) => <span className="whitespace-nowrap">{format.dateTime(row.scheduledAt ?? row.createdAt)}</span>,
      sortable: true,
      sortValue: (row) => row.scheduledAt ?? row.createdAt,
      width: '11rem',
      skeletonWidth: '14ch',
    },
    {
      id: 'channel',
      header: t('mailings.columns.channel'),
      cell: (row) => <span className="line-clamp-1">{CHANNEL_LABEL[row.channel]}</span>,
      mobile: 'subtitle',
      width: '13rem',
      skeletonWidth: '16ch',
    },
    // Текст — одна строка с многоточием: высота строки не зависит от длины рассылки, скелетон той же высоты
    { id: 'text', header: t('mailings.columns.text'), cell: (row) => <span className="block max-w-[16rem] truncate" title={row.text}>{row.text}</span>, width: '18rem', skeletonWidth: '60%' },
    {
      id: 'audience',
      header: t('mailings.columns.audience'),
      cell: (row) => <span className="line-clamp-1">{row.audienceLabel}</span>,
      mobile: 'meta',
      width: '11rem',
      skeletonWidth: '12ch',
    },
    {
      id: 'count',
      header: t('mailings.columns.count'),
      cell: (row) => row.recipientsCount,
      align: 'right',
      sortable: true,
      mobile: 'aside',
      width: '7rem',
      skeletonWidth: '3ch',
    },
    {
      id: 'status',
      header: t('mailings.columns.status'),
      cell: (row) => (
        <Badge tone={row.status === 'sent' ? 'success' : row.status === 'sending' || row.status === 'scheduled' ? 'info' : 'danger'} size="sm">
          {t(`mailings.status.${row.status}`)}
        </Badge>
      ),
      mobile: 'badge',
      width: '9rem',
      skeleton: (
        <Badge tone="neutral" size="sm">
          <SkeletonText width="9ch" />
        </Badge>
      ),
    },
  ];

  return (
    <div data-f="F-05-092 F-05-111 F-00-199" className="flex flex-col gap-6">
      <PageHeader
        title={t('mailings.title')}
        description={t('mailings.subtitle')}
        actions={
          <Button leftIcon={<Plus aria-hidden />} onClick={() => router.push('/biz/notifications/mailings/new')}>
            {t('mailings.create')}
          </Button>
        }
      />

      {/* Числа как заголовок карточки (DESIGN.md): было — одна строка текста мельче под шапкой, без обзора активности */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
        <StatCard label={t('mailings.stats.total')} value={totalMailings} icon={<Megaphone aria-hidden />} loading={statsLoading} />
        <StatCard label={t('mailings.stats.recipients')} value={totalRecipients} icon={<Users aria-hidden />} loading={statsLoading} />
        <StatCard
          label={t('mailings.stats.pushWeek')}
          // Коротко «0 / 3» — в одну строку крупного числа (фраза целиком переносилась, и плитка вырастала после загрузки)
          value={`${pushUsed} / ${WEEKLY_PUSH_LIMIT}`}
          icon={<Send aria-hidden />}
          loading={statsLoading || limitQ.isLoading}
          hint={t('mailings.stats.pushWeekHint')}
        />
      </div>

      <div data-f="F-05-095" className="rounded-lg border border-border bg-surface-2/60 p-4 text-sm text-muted">
        <p className="flex items-start gap-2">
          <Megaphone aria-hidden className="mt-0.5 size-4 shrink-0" />
          {/* F-05-095: одна цельная фраза с параметрами, а не склейка двух отдельных переводов */}
          <span>
            {/* Пока число не пришло — та же фраза с полосой на месте числа (раньше фраза менялась и текст прыгал) */}
            {limitQ.isError
              ? t('mailings.rulesText')
              : limitQ.data !== undefined
                ? t('mailings.rulesTextWithLimit', { used: limitQ.data, total: WEEKLY_PUSH_LIMIT })
                : t('mailings.rulesTextWithLimit', { used: USED_MARK, total: WEEKLY_PUSH_LIMIT })
                    .split(USED_MARK)
                    .flatMap((part, i) => (i === 0 ? [part] : [<SkeletonText key={i} width="1ch" />, part]))}
          </span>
        </p>
      </div>

      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <SectionCard title={t('mailings.historyTitle')} padding="none">
          <div className="p-1 sm:p-1.5">
            <Table
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              loading={!ready || q.isLoading}
              loadingRows={2}
              defaultSort={{ columnId: 'date', dir: 'desc' }}
              empty={
                <EmptyState
                  title={t('mailings.emptyTitle')}
                  description={t('mailings.emptyText')}
                  action={
                    <Button leftIcon={<Plus aria-hidden />} onClick={() => router.push('/biz/notifications/mailings/new')}>
                      {t('mailings.create')}
                    </Button>
                  }
                />
              }
            />
          </div>
        </SectionCard>
      )}
    </div>
  );
}
