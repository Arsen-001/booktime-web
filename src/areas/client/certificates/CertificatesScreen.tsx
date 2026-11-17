'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { GiftCertificateWithBusiness } from '@/api/client';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { PurchaseStatusBadge } from '@/areas/client/purchases/PurchaseStatusCard';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { Card } from '@/ui/Card';

/** Сертификат карточкой — на странице салона в «Картах и абонементах» (/cards/<салон>, 17.11.2026) */
/** showBusiness=false — на странице салона: его имя уже в заголовке */
export function CertificateCard({ certificate, showBusiness = true }: { certificate: GiftCertificateWithBusiness; showBusiness?: boolean }) {
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
            {showBusiness && (
              <span data-f="F-14-042">
                <Avatar name={certificate.businessName} src={certificate.businessLogoUrl} size="md" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-fg">{fmt.money(certificate.faceValue)}</p>
              {showBusiness && <p className="truncate text-sm text-muted">{certificate.businessName}</p>}
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
