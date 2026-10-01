'use client';

/**
 * «Ждут отметки» (F-00-127): прошедшие записи без «пришёл / не пришёл». Сумма визита правится прямо в строке;
 * отметка — одна операция api (статус + сумма + пересчёт автоправил). Сумма — своё поле в маленьком компоненте строки.
 */
import { CircleCheckBig } from 'lucide-react';
import { listPendingMarks } from '@/api/clients';
import { useApiQuery } from '@/api/request';
import { PendingMarkRow, PendingMarkRowSkeleton } from '@/areas/clients/components/summary/PendingMarkRow';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { SectionCard } from '@/ui/SectionCard';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

export function PendingMarksCard({ businessId }: { businessId: Id }) {
  const t = useT('clients');
  const pendingQ = useApiQuery(['clients', 'pendingMarks', businessId], () => listPendingMarks(businessId));
  const rows = pendingQ.data ?? [];
  const skeletonRows = useSkeletonCount('pendingMarks', { loading: pendingQ.isLoading, count: pendingQ.data?.length, fallback: 2, max: 10 });
  return (
    <div data-f="F-00-127">
      <SectionCard title={t('summary.pendingTitle')} description={t('summary.pendingHint')}>
        {pendingQ.isLoading ? (
          <ul className="flex flex-col gap-3" aria-busy>
            {Array.from({ length: skeletonRows }, (_, i) => (
              <PendingMarkRowSkeleton key={i} />
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<CircleCheckBig aria-hidden />}
            title={t('summary.pendingEmptyTitle')}
            description={t('summary.pendingEmptyText')}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((m) => (
              <PendingMarkRow key={m.bookingId} mark={m} />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
