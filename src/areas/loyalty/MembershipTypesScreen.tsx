'use client';

/**
 * /biz/loyalty/memberships/types — список типов абонементов (F-06-105): вкладки «Активные» / «Архивные»
 * (F-06-116: архивные восстанавливаются кнопкой прямо из списка). Форма создания/правки — b03
 * (/biz/loyalty/memberships/types/new, /biz/loyalty/memberships/types/[typeId]).
 */
import { useState } from 'react';
import Link from 'next/link';
import { Gift, Plus } from 'lucide-react';
import { listMembershipTypes, setMembershipTypeArchived } from '@/api/loyalty';
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

export function MembershipTypesScreen() {
  const t = useT('loyalty');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const [tab, setTab] = useState<'active' | 'archived'>('active');

  const q = useApiQuery(['loyalty', 'membershipTypes', businessId], () => listMembershipTypes(businessId!), { enabled: ready && Boolean(businessId) });
  const archiveMutation = useApiMutation(({ id, archived }: { id: string; archived: boolean }) => setMembershipTypeArchived(businessId!, id, archived));

  const restore = async (id: string) => {
    try {
      await archiveMutation.mutate({ id, archived: false });
      toast.success(t('membershipTypeForm.restored'));
    } catch {
      toast.error(t('membershipTypeForm.saveFailed'));
    }
  };

  const all = q.data ?? [];
  const items = all.filter((m) => (tab === 'archived' ? m.archived : !m.archived));
  // Скелетон — столько строк, сколько было в прошлый раз (в демо — 2–3 активных типа)
  const skeletonRows = useSkeletonCount(`membershipTypes-${tab}`, { loading: q.isLoading, count: items.length, fallback: 2 });
  const countBadge = (n: number) => (q.isLoading ? <SkeletonText width="1ch" /> : n);
  if (q.isError) return <ErrorState onRetry={q.refetch} />;

  return (
    <div data-f="F-06-105" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('membershipTypes.title')}
        description={t('membershipTypes.subtitle')}
        actions={
          <LinkButton href="/biz/loyalty/memberships/types/new" leftIcon={<Plus aria-hidden />}>
            {t('membershipTypes.add')}
          </LinkButton>
        }
      />

      <Tabs
        items={[
          { value: 'active', label: t('membershipTypes.activeTab'), badge: countBadge(all.filter((m) => !m.archived).length) },
          { value: 'archived', label: t('membershipTypes.archivedTab'), badge: countBadge(all.filter((m) => m.archived).length) },
        ]}
        value={tab}
        onValueChange={(v) => setTab(v as 'active' | 'archived')}
      />

      {q.isLoading ? (
        <TypeListSkeleton rows={skeletonRows} subtitle={false} aside={tab === 'archived' ? undefined : '9ch'} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Gift aria-hidden />}
          title={tab === 'archived' ? t('membershipTypes.emptyArchivedTitle') : t('membershipTypes.emptyTitle')}
          description={tab === 'active' ? t('membershipTypes.emptyText') : undefined}
          action={
            tab === 'active' ? (
              <LinkButton href="/biz/loyalty/memberships/types/new" leftIcon={<Plus aria-hidden />}>
                {t('membershipTypes.add')}
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <Link href={`/biz/loyalty/memberships/types/${m.id}`} className="min-h-10 min-w-0 flex-1 py-1 text-left">
                <span className="block truncate text-sm font-semibold text-fg underline decoration-border-strong underline-offset-2">{m.name}</span>
              </Link>
              {tab === 'archived' ? (
                <Button variant="secondary" size="sm" onClick={() => restore(m.id)} loading={archiveMutation.isPending}>
                  {t('membershipTypes.restore')}
                </Button>
              ) : (
                <span className="text-xs text-muted">{t('membershipTypes.soldCount', { count: m.soldCount })}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
