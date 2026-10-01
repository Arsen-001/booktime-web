'use client';

/** /biz/stock/equipment — список оборудования (⭐ F-00-141: покупка, обслуживание, замена, гарантия). */
import { useRouter } from 'next/navigation';
import { Wrench } from 'lucide-react';
import { listEquipment } from '@/api/stock';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { today } from '@/lib/date';
import { Badge } from '@/ui/Badge';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { HelpArticleButton } from '@/areas/stock/HelpArticleButton';

/** Скелетон строки оборудования — та же разметка: название, «Куплено …», «Гарантия до …» */
function EquipmentRowSkeleton() {
  return (
    <li className="rounded-xl border border-border bg-surface px-4 py-3">
      <span className="flex min-h-10 w-full flex-col items-start gap-1 text-left">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-fg">
            <SkeletonText width="14ch" />
          </span>
        </span>
        <span className="text-xs text-muted">
          <SkeletonText width="22ch" />
        </span>
        <span className="text-xs text-muted">
          <SkeletonText width="26ch" />
        </span>
      </span>
    </li>
  );
}

export function EquipmentScreen() {
  const t = useT('stock');
  const router = useRouter();
  const format = useFormat();
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const q = useApiQuery(['stock', 'equipment', businessId, locationId], () => listEquipment(businessId!, locationId!), { enabled: ready && Boolean(businessId) && Boolean(locationId) });

  const skeletonRows = useSkeletonCount('equipment', { loading: q.isLoading, count: q.data?.length, fallback: 1, max: 8 });

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  const items = q.data ?? [];
  const now = today();

  return (
    <div data-f="F-00-141" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('equipment.title')}
        description={t('equipment.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <HelpArticleButton titleKey="help.equipment.title" bodyKey="help.equipment.body" />
            <LinkButton href="/biz/stock/equipment/new">{t('equipment.add')}</LinkButton>
          </div>
        }
      />

      {q.isLoading ? (
        <ul className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: skeletonRows }, (_, i) => (
            <EquipmentRowSkeleton key={i} />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Wrench aria-hidden />}
          title={t('equipment.emptyTitle')}
          description={t('equipment.emptyText')}
          action={<LinkButton href="/biz/stock/equipment/new">{t('equipment.add')}</LinkButton>}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((e) => {
            const dueSoon = Boolean(e.replaceReminderDate && e.replaceReminderDate <= now);
            return (
              <li key={e.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                <button type="button" onClick={() => router.push(`/biz/stock/equipment/${e.id}`)} className="flex min-h-10 w-full flex-col items-start gap-1 text-left">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-fg">{e.name}</span>
                    {dueSoon && (
                      <Badge tone="warning" size="sm">
                        {t('equipment.replaceSoon')}
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-muted">{t('equipment.purchased', { date: format.date(e.purchaseDate, 'long') })}</span>
                  {e.warrantyUntil && <span className="text-xs text-muted">{t('equipment.warrantyUntil', { date: format.date(e.warrantyUntil, 'long') })}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
