'use client';

import Image from 'next/image';
import { getCertificate } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { PurchaseStatusBadge, PurchaseStatusCard } from '@/areas/client/purchases/PurchaseStatusCard';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Card } from '@/ui/Card';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';

/** Карточка сертификата: номинал, остаток, срок, ограничения (F-14-040) */
export function CertificateDetailScreen({ certificateId }: { certificateId: Id }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const { ready, appUserId } = useCurrent();
  const q = useApiQuery(['certificate', certificateId, appUserId], () => getCertificate(certificateId, appUserId), {
    enabled: ready,
  });

  if (!ready || q.isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton variant="rect" className="h-32 rounded-2xl" />
      </div>
    );
  }
  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  const c = q.data;
  if (!c)
    return (
      <EmptyState
        title={t('certificates.notFound')}
        action={<LinkButton href="/certificates">{t('certificates.title')}</LinkButton>}
      />
    );

  const appliesLabel =
    c.appliesTo === 'services' ? t('certificates.appliesServices') : c.appliesTo === 'products' ? t('certificates.appliesProducts') : t('certificates.appliesAnything');

  return (
    <div data-f="F-14-040" className="flex flex-col gap-5 pb-6">
      <PageHeader back={{ href: '/certificates' }} title={fmt.money(c.faceValue)} />
      {c.imageUrl && (
        <div data-f="F-14-041" className="relative h-40 w-full overflow-hidden rounded-2xl">
          <Image src={c.imageUrl} alt="" fill sizes="(max-width: 640px) 100vw, 480px" className="object-cover" unoptimized />
        </div>
      )}
      <Card padding="md">
        <div className="flex items-center gap-3">
          <Avatar name={c.businessName} src={c.businessLogoUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-fg">{c.businessName}</p>
            <p className="text-sm text-muted">{c.number}</p>
          </div>
        </div>
        {c.purchaseStatus === 'confirmed' && !c.active && (
          <Badge tone="neutral" variant="soft" className="mt-3">
            {t('certificates.usedUp')}
          </Badge>
        )}
        {c.purchaseStatus !== 'confirmed' && (
          <div className="mt-3">
            <PurchaseStatusBadge status={c.purchaseStatus} />
          </div>
        )}
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <Row label={t('certificates.balanceLabel')} value={t('certificates.balanceValue', { balance: fmt.money(c.balance), faceValue: fmt.money(c.faceValue) })} />
          <Row label={t('certificates.usesLabel')} value={c.usesLimit === 'once' ? t('certificates.singleUse') : t('certificates.multiUse')} />
          <Row label={t('certificates.appliesLabel')} value={appliesLabel} />
          <Row label={t('certificates.validUntilLabel')} value={fmt.date(c.validUntil, 'long')} />
        </dl>
      </Card>

      {c.purchaseStatus !== 'confirmed' && (
        <PurchaseStatusCard
          kind="certificate"
          id={c.id}
          appUserId={appUserId}
          businessId={c.businessId}
          price={c.faceValue}
          status={c.purchaseStatus}
          paymentSentAt={c.paymentSentAt}
          onChanged={() => void q.refetch()}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-fg">{value}</dd>
    </div>
  );
}
