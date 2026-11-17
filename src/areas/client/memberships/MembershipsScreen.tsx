'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { Snowflake, Flame } from 'lucide-react';
import type { MembershipWithBusiness } from '@/api/client';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { daysUntil } from '@/areas/client/loyalty/loyaltyDates';
import { PurchaseStatusBadge } from '@/areas/client/purchases/PurchaseStatusCard';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Card } from '@/ui/Card';

/** Абонемент карточкой — на странице салона в «Картах и абонементах» (/cards/<салон>, 17.11.2026) */
/** showBusiness=false — на странице салона: его имя уже в заголовке */
export function MembershipCard({ membership, showBusiness = true }: { membership: MembershipWithBusiness; showBusiness?: boolean }) {
  const t = useT('client');
  const locale = useLocale();
  const fmt = useClientFormat();
  const daysLeft = daysUntil(membership.validUntil);
  const expiringSoon = membership.visitsLeft <= 1 || daysLeft <= 5;

  return (
    <Link href={`/memberships/${membership.id}`}>
      <Card interactive padding="none" className="flex flex-col gap-3 overflow-hidden">
        {membership.imageUrl && (
          <div data-f="F-14-041" className="relative h-28 w-full">
            <Image src={membership.imageUrl} alt="" fill sizes="(max-width: 640px) 100vw, 320px" className="object-cover" unoptimized />
          </div>
        )}
        <div className={`flex flex-col gap-3 ${membership.imageUrl ? 'px-4 pb-4' : 'p-4'}`}>
          <div className="flex items-center gap-3">
            {showBusiness && (
              <span data-f="F-14-042">
                <Avatar name={membership.businessName} src={membership.businessLogoUrl} size="md" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-fg">{pickText(membership.title, locale)}</p>
              {showBusiness && <p className="truncate text-sm text-muted">{membership.businessName}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <PurchaseStatusBadge status={membership.purchaseStatus} />
            {membership.frozen && (
              <Badge tone="info" variant="soft" data-f="F-14-038">
                <Snowflake aria-hidden className="mr-1 size-3.5" />
                {t('memberships.frozen')}
              </Badge>
            )}
            {expiringSoon && !membership.frozen && (
              <Badge tone="warning" variant="soft" data-f="F-14-038">
                <Flame aria-hidden className="mr-1 size-3.5" />
                {t('memberships.expiringSoon')}
              </Badge>
            )}
          </div>
          <p className="text-sm text-fg">{t('memberships.visitsLeft', { left: membership.visitsLeft, total: membership.visitsTotal })}</p>
          <p className="text-sm text-muted">{t('memberships.validUntil', { date: fmt.date(membership.validUntil) })}</p>
        </div>
      </Card>
    </Link>
  );
}
