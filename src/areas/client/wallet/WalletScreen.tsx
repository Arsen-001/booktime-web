'use client';

import { ChevronRight, WalletCards } from 'lucide-react';
import { listWallet } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { LoginGate } from '@/areas/client/ui/GuestGate';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useDisplayName } from '@/areas/client/useDisplayName';
import { walletSummary } from '@/areas/client/wallet/walletSummary';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

/** Ключ одного запроса для списка и страницы салона: из списка в салон — без загрузки */
export const walletKey = (appUserId: string | undefined) => ['wallet', appUserId] as const;

/**
 * «Карты и абонементы» (владелец 17.11.2026, DESIGN.md №4) — одна страница вместо трёх («Абонементы», «Сертификаты»,
 * «Карты лояльности»): строка на салон — логотип, имя и коротко всё, что там есть; нажал — всё про этот салон.
 */
export function WalletScreen() {
  const t = useT('client');
  const fmt = useClientFormat();
  const nameOf = useDisplayName();
  const { ready, appUserId } = useCurrent();
  const q = useApiQuery(walletKey(appUserId), () => listWallet(appUserId!), { enabled: ready && Boolean(appUserId) });

  return (
    <div data-f="F-14-037 F-14-040 F-14-054" className="flex flex-col gap-5 pb-6">
      <PageHeader title={t('wallet.title')} description={t('wallet.subtitle')} />
      {ready && !appUserId ? (
        <LoginGate icon={<WalletCards aria-hidden className="size-8 text-muted" />} next="/cards" />
      ) : !ready || q.isLoading ? (
        <ul className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Card padding="sm" className="flex min-h-16 items-center gap-3">
                <Skeleton variant="circle" className="size-10 shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-medium text-fg">
                    <SkeletonText width="14ch" />
                  </span>
                  <span className="truncate text-sm text-muted">
                    <SkeletonText width="24ch" />
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
              </Card>
            </li>
          ))}
        </ul>
      ) : q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : !q.data?.length ? (
        <EmptyState icon={<WalletCards aria-hidden className="size-8 text-muted" />} title={t('wallet.emptyTitle')} description={t('wallet.emptyHint')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {q.data.map((p) => (
            <li key={p.businessId}>
              <Card href={`/cards/${p.businessId}`} padding="sm" className="flex min-h-16 items-center gap-3">
                <span data-f="F-14-042">
                  <Avatar name={p.businessName} src={p.businessLogoUrl} size="md" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-fg">{nameOf(p.businessName)}</span>
                  <span className="line-clamp-2 text-sm text-muted">{walletSummary(p, t, fmt).join(' · ')}</span>
                </span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
