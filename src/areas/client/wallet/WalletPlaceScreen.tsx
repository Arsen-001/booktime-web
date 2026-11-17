'use client';

import { WalletCards } from 'lucide-react';
import { listWallet } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { CertificateCard } from '@/areas/client/certificates/CertificatesScreen';
import { LoyaltyCardRowItem } from '@/areas/client/loyalty/LoyaltyCardsScreen';
import { MembershipCard } from '@/areas/client/memberships/MembershipsScreen';
import { LoginGate } from '@/areas/client/ui/GuestGate';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useDisplayName } from '@/areas/client/useDisplayName';
import { walletKey } from '@/areas/client/wallet/WalletScreen';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { LinkButton } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

/**
 * «Карты и абонементы» → салон (владелец 17.11.2026, DESIGN.md №4): всё про этот салон — карта лояльности, личный
 * счёт, абонементы, сертификаты. Тот же запрос, что у списка: из строки списка страница открывается без загрузки.
 */
export function WalletPlaceScreen({ businessId }: { businessId: Id }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const nameOf = useDisplayName();
  const { ready, appUserId } = useCurrent();
  const q = useApiQuery(walletKey(appUserId), () => listWallet(appUserId!), { enabled: ready && Boolean(appUserId) });
  const place = q.data?.find((p) => p.businessId === businessId);
  const loading = !ready || (Boolean(appUserId) && q.isLoading);

  return (
    <div data-f="F-14-037 F-14-040 F-14-054" className="flex flex-col gap-5 pb-6">
      <PageHeader back={{ href: '/cards' }} title={loading ? <SkeletonText width="14ch" /> : place ? nameOf(place.businessName) : t('wallet.title')} />
      {ready && !appUserId ? (
        <LoginGate icon={<WalletCards aria-hidden className="size-8 text-muted" />} next={`/cards/${businessId}`} />
      ) : loading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton variant="rect" className="h-32 rounded-2xl" />
          <Skeleton variant="rect" className="h-40 rounded-2xl" />
        </div>
      ) : q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : !place ? (
        <EmptyState
          icon={<WalletCards aria-hidden className="size-8 text-muted" />}
          title={t('wallet.placeEmpty')}
          action={<LinkButton href="/cards">{t('wallet.title')}</LinkButton>}
        />
      ) : (
        <>
          {place.cards.length > 0 && (
            <section className="flex flex-col gap-2" data-f="F-14-054">
              <h2 className="font-semibold text-fg">{t('wallet.sectionCard')}</h2>
              {place.cards.map((card) => (
                <LoyaltyCardRowItem key={card.id} card={card} showBusiness={false} />
              ))}
            </section>
          )}
          {place.accounts.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-semibold text-fg">{t('wallet.sectionAccount')}</h2>
              {place.accounts.map((a) => (
                <Card key={a.id} padding="md" className="flex items-center gap-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-fg">{a.name || t('wallet.sectionAccount')}</span>
                    <span className="text-sm text-muted">{t('wallet.accountHint')}</span>
                  </span>
                  <span className={a.balance < 0 ? 'shrink-0 font-semibold text-danger' : 'shrink-0 font-semibold text-fg'}>{fmt.money(a.balance)}</span>
                </Card>
              ))}
            </section>
          )}
          {place.memberships.length > 0 && (
            <section className="flex flex-col gap-2" data-f="F-14-037">
              <h2 className="font-semibold text-fg">{t('wallet.sectionMemberships')}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {place.memberships.map((m) => (
                  <MembershipCard key={m.id} membership={m} showBusiness={false} />
                ))}
              </div>
            </section>
          )}
          {place.certificates.length > 0 && (
            <section className="flex flex-col gap-2" data-f="F-14-040">
              <h2 className="font-semibold text-fg">{t('wallet.sectionCertificates')}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {place.certificates.map((c) => (
                  <CertificateCard key={c.id} certificate={c} showBusiness={false} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
