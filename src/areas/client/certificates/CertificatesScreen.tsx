'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Gift } from 'lucide-react';
import { listCertificates, type GiftCertificateWithBusiness } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { PurchaseStatusBadge } from '@/areas/client/purchases/PurchaseStatusCard';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { Skeleton } from '@/ui/Skeleton';

/** Сертификаты клиента — карточками (F-14-040) */
export function CertificatesScreen() {
  const t = useT('client');
  const { ready, appUserId } = useCurrent();
  const q = useApiQuery(['certificates', appUserId], () => listCertificates(appUserId!), {
    enabled: ready && Boolean(appUserId),
  });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);

  return (
    <div data-f="F-14-040" className="flex flex-col gap-5 pb-6">
      <PageHeader title={t('certificates.title')} />
      {!ready || q.isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton variant="rect" className="h-32 rounded-2xl" />
          <Skeleton variant="rect" className="h-32 rounded-2xl" />
        </div>
      ) : q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : !q.data?.length ? (
        <EmptyState icon={<Gift aria-hidden className="size-8 text-muted" />} title={t('certificates.emptyTitle')} description={t('certificates.emptyHint')} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pageItems.map((c) => (
              <CertificateCard key={c.id} certificate={c} />
            ))}
          </div>
          {pager}
        </>
      )}
    </div>
  );
}

export function CertificateCard({ certificate }: { certificate: GiftCertificateWithBusiness }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const appliesLabel =
    certificate.appliesTo === 'services'
      ? t('certificates.appliesServices')
      : certificate.appliesTo === 'products'
        ? t('certificates.appliesProducts')
        : t('certificates.appliesAnything');

  return (
    <Link href={`/certificates/${certificate.id}`}>
      <Card interactive padding="none" className="flex flex-col gap-3 overflow-hidden">
        {certificate.imageUrl && (
          <div data-f="F-14-041" className="relative h-28 w-full">
            <Image src={certificate.imageUrl} alt="" fill sizes="(max-width: 640px) 100vw, 320px" className="object-cover" unoptimized />
          </div>
        )}
        <div className={`flex flex-col gap-3 ${certificate.imageUrl ? 'px-4 pb-4' : 'p-4'}`}>
          <div className="flex items-center gap-3">
            <span data-f="F-14-042">
              <Avatar name={certificate.businessName} src={certificate.businessLogoUrl} size="md" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-fg">{fmt.money(certificate.faceValue)}</p>
              <p className="truncate text-sm text-muted">{certificate.businessName}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <PurchaseStatusBadge status={certificate.purchaseStatus} />
          </div>
          <p className="text-sm text-fg">
            {t('certificates.balance', { balance: fmt.money(certificate.balance), faceValue: fmt.money(certificate.faceValue) })}
          </p>
          <p className="text-sm text-muted">{certificate.usesLimit === 'once' ? t('certificates.singleUse') : t('certificates.multiUse')}</p>
          <p className="text-sm text-muted">{appliesLabel}</p>
          <p className="text-sm text-muted">{t('certificates.validUntil', { date: fmt.date(certificate.validUntil) })}</p>
        </div>
      </Card>
    </Link>
  );
}
