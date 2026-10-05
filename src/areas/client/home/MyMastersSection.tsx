'use client';

import Link from 'next/link';
import { getCashbackForBusiness, listBookedMasters } from '@/api/client-public';
import { useApiQuery } from '@/api/request';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { InlineError } from '@/areas/client/ui/InlineError';
import { SectionHeader } from '@/areas/client/ui/SectionHeader';
import { useDisplayName } from '@/areas/client/useDisplayName';
import { useClientFormat } from '@/areas/client/useClientFormat';
import type { Id } from '@/domain/core';
import { useLocalizedHref } from '@/i18n/useLocalizedHref';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { ScrollRow } from '@/ui/ScrollRow';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

/** «Мои мастера» (F-14-009, F-00-010): только те, к кому клиент записывался сам; пусто — блока нет */
export function MyMastersSection({ appUserId }: { appUserId: Id | undefined }) {
  const t = useT('client');
  const q = useApiQuery(clientKeys.bookedMasters(appUserId ?? ''), () => listBookedMasters(appUserId ?? ''), { enabled: Boolean(appUserId) });
  const skeletonCount = useSkeletonCount('home-my-masters', { loading: q.isLoading, count: q.data?.length, fallback: 4, max: 8 });
  if (q.isLoading) {
    // Та же секция до данных: заголовок с «Все», мастера кружками с именем
    return (
      <section aria-busy="true" className="flex flex-col gap-3">
        <SectionHeader title={t('home.myMasters.title')} href="/favorites" linkLabel={t('home.myMasters.all')} />
        <ScrollRow bleed gap="md" arrows={false}>
          {Array.from({ length: skeletonCount }, (_, i) => (
            <span key={i} className="flex w-20 flex-col items-center gap-1.5 py-1 text-center">
              <Skeleton variant="circle" className="inline-flex size-12 shrink-0" />
              <span className="w-full truncate text-sm font-medium text-fg">
                <SkeletonText width="6ch" />
              </span>
            </span>
          ))}
        </ScrollRow>
      </section>
    );
  }
  if (q.isError) return <InlineError onRetry={q.refetch} />;
  if (!appUserId || !q.data?.length) return null;

  return (
    <section data-f="F-14-010 F-14-009 F-00-010" className="flex flex-col gap-3">
      <SectionHeader title={t('home.myMasters.title')} href="/favorites" linkLabel={t('home.myMasters.all')} />
      <ScrollRow bleed gap="md" aria-label={t('home.myMasters.title')}>
        {q.data.map((m) => (
          <MyMasterItem key={m.id} staffId={m.id} businessId={m.businessId} name={m.name} avatarUrl={m.avatarUrl} colorIndex={m.colorIndex} appUserId={appUserId} />
        ))}
      </ScrollRow>
    </section>
  );
}

/** Мастер кружком с именем (без фамилии — ux-r1 №5: «Карен Мел…») и ненулевым кэшбэком салона (F-14-048) */
function MyMasterItem({
  staffId,
  businessId,
  name,
  avatarUrl,
  colorIndex,
  appUserId,
}: {
  staffId: Id;
  businessId: Id;
  name: string;
  avatarUrl?: string;
  colorIndex?: number;
  appUserId: Id;
}) {
  const fmt = useClientFormat();
  const nameOf = useDisplayName();
  const q = useApiQuery(clientKeys.cashback(businessId, appUserId), () => getCashbackForBusiness(appUserId, businessId));
  const cashback = q.data && q.data.balance > 0 ? q.data.balance : undefined;
  const localized = useLocalizedHref();
  return (
    <Link
      href={localized(`/masters/${staffId}`)}
      className="flex w-20 flex-col items-center gap-1.5 rounded-xl py-1 text-center focus-visible:outline-2 focus-visible:outline-focus"
    >
      <Avatar name={name} src={avatarUrl} colorIndex={colorIndex} size="lg" />
      <span className="w-full truncate text-sm font-medium text-fg">{nameOf(name).split(' ')[0]}</span>
      {cashback !== undefined && (
        <span data-f="F-14-048" className="w-full truncate text-xs font-medium text-success">
          {fmt.money(cashback)}
        </span>
      )}
    </Link>
  );
}
