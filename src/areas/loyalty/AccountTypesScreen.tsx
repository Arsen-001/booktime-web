'use client';

/**
 * /biz/loyalty/deposits/types — типы счетов клиентов (F-06-135). Форма создания/правки — модалка
 * AccountTypeFormModal (пачка b03, F-06-136 «Оплата в минус»).
 */
import { useState } from 'react';
import { Plus, Wallet } from 'lucide-react';
import { listAccountTypes } from '@/api/loyalty';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { AccountType } from '@/domain/loyalty';
import { useT } from '@/i18n/useT';
import { AccountTypeFormModal } from '@/areas/loyalty/account-types/AccountTypeFormModal';
import { TypeListSkeleton } from '@/areas/loyalty/components/Skeletons';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

export function AccountTypesScreen() {
  const t = useT('loyalty');
  const { ready, businessId } = useCurrent();
  const [editing, setEditing] = useState<AccountType | 'new' | null>(null);

  const q = useApiQuery(['loyalty', 'accountTypes', businessId], () => listAccountTypes(businessId!), { enabled: ready && Boolean(businessId) });

  const items = q.data ?? [];
  // Скелетон — столько строк, сколько было в прошлый раз (в демо — один тип «Депозит»)
  const skeletonRows = useSkeletonCount('accountTypes', { loading: q.isLoading, count: items.length, fallback: 1 });
  if (q.isError) return <ErrorState onRetry={q.refetch} />;

  return (
    <div data-f="F-06-135" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('accountTypes.title')}
        description={t('accountTypes.subtitle')}
        actions={
          <Button leftIcon={<Plus aria-hidden />} onClick={() => setEditing('new')}>
            {t('accountTypes.add')}
          </Button>
        }
      />

      {q.isLoading ? (
        <TypeListSkeleton rows={skeletonRows} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Wallet aria-hidden />}
          title={t('accountTypes.emptyTitle')}
          action={
            <Button leftIcon={<Plus aria-hidden />} onClick={() => setEditing('new')}>
              {t('accountTypes.add')}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((tp) => (
            <li key={tp.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <button type="button" onClick={() => setEditing(tp)} className="min-h-10 min-w-0 flex-1 py-1 text-left">
                <span className="block truncate text-sm font-semibold text-fg underline decoration-border-strong underline-offset-2">{tp.name}</span>
                <span className="block text-xs text-muted">{tp.allowNegative ? t('accountTypes.allowsNegative') : t('accountTypes.noNegative')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AccountTypeFormModal
        key={editing === 'new' || editing === null ? 'new' : editing.id}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        initial={editing && editing !== 'new' ? editing : undefined}
      />
    </div>
  );
}
