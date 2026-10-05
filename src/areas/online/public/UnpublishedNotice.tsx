'use client';

import { CalendarClock, Phone } from 'lucide-react';
import { getUnpublishedContact } from '@/api/online-public';
import { useApiQuery } from '@/api/request';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { telLink } from '@/lib/phone';
import { buttonClasses } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Skeleton } from '@/ui/Skeleton';

/**
 * О24: салон ещё не опубликован — клиенту не «ссылка с опечаткой», а «онлайн-запись скоро откроется» и телефон
 * салона, чтобы записаться звонком. Владелец, разославший ссылку до публикации, не получит жалоб «ссылка битая».
 */
export function UnpublishedNotice({ slug }: { slug: string }) {
  const t = useT('online');
  const format = useFormat();
  const q = useApiQuery(['online', 'unpublished-contact', slug], () => getUnpublishedContact(slug));
  if (q.isLoading) return <Skeleton variant="rect" className="h-56 rounded-2xl" />;
  const contact = q.data;
  return (
    <EmptyState
      icon={<CalendarClock aria-hidden />}
      title={contact?.name ? t('public.soon.titleNamed', { name: contact.name }) : t('public.soon.title')}
      description={t('public.soon.description')}
      action={
        contact?.phone ? (
          <a href={telLink(contact.phone)} className={buttonClasses({ variant: 'secondary' })}>
            <Phone aria-hidden className="size-4" />
            {format.phone(contact.phone)}
          </a>
        ) : undefined
      }
    />
  );
}
