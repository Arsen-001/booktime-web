'use client';

/**
 * /biz/loyalty/card-types — список типов карт (F-06-020): вкладки «Активные» / «Архивные»
 * (F-06-030/questions-q4 В-40: архивные восстанавливаются кнопкой прямо из списка). Форма создания —
 * /biz/loyalty/card-types/new (F-06-021…F-06-028), правка/удаление/архив — /biz/loyalty/card-types/[typeId].
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Plus } from 'lucide-react';
import { listCardTypes, setCardTypeArchived } from '@/api/loyalty';
import { useApiMutation, useApiQuery } from '@/api/request';
import { TypeListSkeleton } from '@/areas/loyalty/components/Skeletons';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { Tabs } from '@/ui/Tabs';
import { useToast } from '@/ui/Toast';

export function CardTypesScreen() {
  const t = useT('loyalty');
  const router = useRouter();
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const [tab, setTab] = useState<'active' | 'archived'>('active');

  const q = useApiQuery(['loyalty', 'cardTypes', businessId], () => listCardTypes(businessId!), { enabled: ready && Boolean(businessId) });
  const archiveMutation = useApiMutation(({ id, archived }: { id: string; archived: boolean }) => setCardTypeArchived(businessId!, id, archived));

  const restore = async (id: string) => {
    try {
      await archiveMutation.mutate({ id, archived: false });
      toast.success(t('cardTypeForm.restored'));
    } catch {
      toast.error(t('cardTypeForm.saveFailed'));
    }
  };

  const all = q.data ?? [];
  const items = all.filter((c) => (tab === 'archived' ? c.archived : !c.archived));
  // Скелетон — столько строк, сколько было в прошлый раз (в демо у бизнеса 1–3 типа)
  const skeletonRows = useSkeletonCount(`cardTypes-${tab}`, { loading: q.isLoading, count: items.length, fallback: 1 });
  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  const countBadge = (n: number) => (q.isLoading ? <SkeletonText width="1ch" /> : n);

  return (
    <div data-f="F-06-020" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('cardTypes.title')}
        description={t('cardTypes.subtitle')}
        actions={
          <LinkButton href="/biz/loyalty/card-types/new" leftIcon={<Plus aria-hidden />}>
            {t('cardTypes.add')}
          </LinkButton>
        }
      />

      <Tabs
        items={[
          { value: 'active', label: t('cardTypes.activeTab'), badge: countBadge(all.filter((c) => !c.archived).length) },
          { value: 'archived', label: t('cardTypes.archivedTab'), badge: countBadge(all.filter((c) => c.archived).length) },
        ]}
        value={tab}
        onValueChange={(v) => setTab(v as 'active' | 'archived')}
      />

      {q.isLoading ? (
        <TypeListSkeleton rows={skeletonRows} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CreditCard aria-hidden />}
          title={tab === 'archived' ? t('cardTypes.emptyArchivedTitle') : t('cardTypes.emptyTitle')}
          description={tab === 'active' ? t('cardTypes.emptyText') : undefined}
          action={
            tab === 'active' ? (
              <LinkButton href="/biz/loyalty/card-types/new" leftIcon={<Plus aria-hidden />}>
                {t('cardTypes.add')}
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <button type="button" onClick={() => router.push(`/biz/loyalty/card-types/${c.id}`)} className="min-h-10 min-w-0 flex-1 py-1 text-left">
                <span className="block truncate text-sm font-semibold text-fg underline decoration-border-strong underline-offset-2">{c.name}</span>
                <span className="block text-xs text-muted">{t('cardTypes.issuedCount', { count: c.issuedCount })}</span>
              </button>
              {tab === 'archived' && (
                <Button variant="secondary" size="sm" onClick={() => restore(c.id)} loading={archiveMutation.isPending}>
                  {t('cardTypes.restore')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
