'use client';

/**
 * /platform/sphere-requests — заявки на сферы (наша сторона): «не нашли свою сферу» (F-00-151) и новая сфера по заказу
 * с годом подписки от дня готовности (F-00-152). Открытые — сверху.
 */
import { useState } from 'react';
import { Check, CircleDot, Plus, Shapes } from 'lucide-react';
import { useSphereRequests } from '@/areas/platform/hooks/usePlatformData';
import { SPHERE_REQUEST_TONE } from '@/areas/platform/lib/tones';
import { NewSphereRequestSheet } from '@/areas/platform/sphere-requests/NewSphereRequestSheet';
import { SphereRequestSheet } from '@/areas/platform/sphere-requests/SphereRequestSheet';
import type { SphereRequestKind, SphereRequestView } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Fab } from '@/ui/Fab';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { Tabs } from '@/ui/Tabs';
import { ExitHold } from '@/ui/ExitHold';

export function SphereRequestsScreen() {
  const t = useT('platform');
  const fmt = useFormat();
  const [kind, setKind] = useState<SphereRequestKind>('noSphere');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const q = useSphereRequests(kind);
  const open = q.data?.find((r) => r.id === openId);

  const columns: TableColumn<SphereRequestView>[] = [
    {
      id: 'master',
      header: t('sphereRequests.masterName'),
      mobile: 'title',
      width: '28rem',
      skeleton: (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">
            <SkeletonText width="16ch" />
          </span>
          <span className="truncate text-sm font-normal text-muted">
            <SkeletonText width="30ch" />
          </span>
        </span>
      ),
      cell: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">{r.masterName}</span>
          <span className="truncate text-sm font-normal text-muted">{[r.sphereName, r.businessName, fmt.ago(r.createdAt)].filter(Boolean).join(' · ')}</span>
        </span>
      ),
    },
    { id: 'phone', header: t('sphereRequests.phone'), mobile: 'hidden', width: '11rem', skeletonWidth: '14ch', cell: (r) => <span className="whitespace-nowrap text-muted">{r.phone ? fmt.phone(r.phone) : '—'}</span> },
    {
      id: 'status',
      header: t('sphereRequests.statusLabel'),
      mobile: 'badge',
      align: 'right',
      width: '10rem',
      // Та же плашка со значком, внутри — полоса
      skeleton: (
        <Badge tone="neutral" icon={<CircleDot aria-hidden />}>
          <SkeletonText width="7ch" />
        </Badge>
      ),
      cell: (r) => (
        <Badge tone={SPHERE_REQUEST_TONE[r.status]} icon={r.status === 'open' ? <CircleDot aria-hidden /> : r.status === 'done' ? <Check aria-hidden /> : undefined}>
          {t(`sphereRequests.status.${r.status}`)}
        </Badge>
      ),
    },
  ];

  const addButton = (className?: string) => (
    <Button className={className} leftIcon={<Plus aria-hidden />} onClick={() => setCreating(true)}>
      {t('sphereRequests.add')}
    </Button>
  );

  return (
    <div data-f="F-00-151 F-00-152" className="flex flex-col gap-6">
      <PageHeader title={t('sphereRequests.title')} description={t('sphereRequests.subtitle')} actions={addButton('max-md:hidden')} />
      <div className="flex flex-col gap-2">
        <Tabs
          value={kind}
          onValueChange={(v) => {
            setKind(v as SphereRequestKind);
            setOpenId(null);
          }}
          items={(['noSphere', 'newSphere'] as const).map((k) => ({ value: k, label: t(`sphereRequests.kind.${k}`) }))}
        />
        <p className="text-sm text-muted">{t(`sphereRequests.hint.${kind}`)}</p>
      </div>
      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <Table
          label={t('sphereRequests.title')}
          columns={columns}
          rows={q.data ?? []}
          rowKey={(r) => r.id}
          loading={q.isLoading}
          // В демо — три заявки «нет сферы» и две на новую сферу
          loadingRows={kind === 'noSphere' ? 3 : 2}
          onRowClick={(r) => setOpenId(r.id)}
          empty={<EmptyState icon={<Shapes aria-hidden />} title={t('sphereRequests.empty')} description={t('sphereRequests.emptyHint')} action={addButton()} />}
        />
      )}
      <Fab icon={<Plus />} label={t('sphereRequests.add')} extended onClick={() => setCreating(true)} />
      <ExitHold value={creating}>{() => <NewSphereRequestSheet kind={kind} onClose={() => setCreating(false)} />}</ExitHold>
      <ExitHold value={open}>{(open) => <SphereRequestSheet key={open.id} request={open} onClose={() => setOpenId(null)} />}</ExitHold>
    </div>
  );
}
