'use client';

/**
 * ⭐ «Пригласи подругу» в карточке клиента: «По приглашению: Анна Карапетян» (ссылка на карточку пригласившей) и
 * сколько человек привёл сам клиент. Привязку ставит запись по личной ссылке (rules/referral), здесь — только показ.
 * Строки текста, а не плашки: имя бывает длинным, строка переносится, а не вылезает из узкой колонки.
 */
import { Gift, Users } from 'lucide-react';
import Link from 'next/link';
import { getClientReferralInfo } from '@/api/referral';
import { useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';

export function ClientReferralBadges({ businessId, clientId, gender }: { businessId: Id; clientId: Id; gender: string }) {
  const t = useT('clients');
  const q = useApiQuery(['loyalty', 'client-referral', businessId, clientId], () => getClientReferralInfo(businessId, clientId));
  const info = q.data;
  if (!info || (!info.referredBy && info.invitees.length === 0)) return null;
  const came = info.invitees.filter((i) => i.status === 'visited' || i.status === 'rewarded').length;
  return (
    <div className="flex flex-col gap-1 text-sm" data-f="F-06-084">
      {info.referredBy && (
        <p className="flex items-start gap-1.5 text-fg" data-testid="referred-by">
          <Gift aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-text" />
          <span>
            {t('card.referral.referredByLabel', { gender })}{' '}
            <Link href={`/biz/clients/${info.referredBy.clientId}`} className="font-medium text-primary-text underline-offset-4 hover:underline">
              {info.referredBy.name}
            </Link>
          </span>
        </p>
      )}
      {info.invitees.length > 0 && (
        <p className="flex items-start gap-1.5 text-fg" data-testid="referral-invitees">
          <Users aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
          <span>{t('card.referral.invited', { count: info.invitees.length, came })}</span>
        </p>
      )}
    </div>
  );
}
